import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import type { Photo } from "../LotDetailModal.types";

export function useLotPhotos(
  lotId: string,
  onPhotoCountChanged?: (lotId: string, newCount: number) => void
) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; kind: string } | null>(null);
  const [dragOverKind, setDragOverKind] = useState<"front" | "back" | "extra" | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"front" | "back" | "extra" | null>(null);

  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/photos`);
      const json = await res.json();
      if (json.ok) {
        const loadedPhotos = json.photos || [];
        setPhotos(loadedPhotos);
        return loadedPhotos.length;
      }
      return 0;
    } catch (e) {
      logger.error("Failed to load photos", e, undefined, { lotId });
      return 0;
    } finally {
      setLoadingPhotos(false);
    }
  }, [lotId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Prevent default drag behavior on the document
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  const handlePhotoUploaded = async (newPhoto: Photo, currentPhotoCount: number) => {
    // Optimistically add the photo to the UI immediately
    setPhotos((prev) => [...prev, newPhoto]);
    const newCount = currentPhotoCount + 1;

    // Update parent component's photo count immediately
    onPhotoCountChanged?.(lotId, newCount);

    // Reload photos in the background to ensure consistency and get any additional metadata
    await loadPhotos();
  };

  const validateFile = (file: File): string | null => {
    // Client-side validation (server will also validate)
    if (!file.type.startsWith("image/")) {
      return "Please select an image file";
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return "File size exceeds 10MB limit";
    }

    // Validate allowed image types
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return "Invalid file type. Allowed: JPEG, PNG, WebP, GIF";
    }

    return null;
  };

  const uploadFile = async (
    file: File,
    kind: "front" | "back" | "extra",
    currentPhotoCount: number
  ): Promise<void> => {
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Prevent uploading multiple front or back images
    if (kind === "front" || kind === "back") {
      const existingPhoto = photos.find((p) => p.kind === kind);
      if (existingPhoto) {
        alert(`A ${kind} photo already exists. Please delete it first if you want to replace it.`);
        return;
      }
    }

    setUploadingKind(kind);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      const uploadRes = await fetch(`/api/admin/lots/${lotId}/photos/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      if (uploadJson.photo) {
        await handlePhotoUploaded(
          {
            id: uploadJson.photo.id,
            kind: uploadJson.photo.kind,
            signedUrl: uploadJson.photo.signedUrl || null,
          },
          currentPhotoCount
        );
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Upload failed");
    } finally {
      setUploadingKind(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, kind: "front" | "back" | "extra") => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKind(kind);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKind(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    kind: "front" | "back" | "extra",
    currentPhotoCount: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKind(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file, kind, currentPhotoCount);
    }
  };

  const handleFileSelect = (kind: "front" | "back" | "extra", currentPhotoCount: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await uploadFile(file, kind, currentPhotoCount);
      }
    };
    input.click();
  };

  const downloadImage = async (photo: Photo, cardName?: string) => {
    if (!photo.signedUrl) {
      alert("Image URL not available");
      return;
    }

    try {
      const response = await fetch(photo.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cardName?.replace(/\s+/g, "_") || "card"}_${photo.kind}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      logger.error("Failed to download image", e, undefined, {
        lotId,
        photoId: photo.id,
        photoKind: photo.kind,
      });
      alert("Failed to download image");
    }
  };

  const downloadAllImages = async (cardName?: string) => {
    if (photos.length === 0) {
      alert("No images to download");
      return;
    }

    for (const photo of photos) {
      await downloadImage(photo, cardName);
      // Small delay between downloads to avoid browser blocking
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  const handleDeletePhoto = (photoId: string, photoKind: string) => {
    setPhotoToDelete({ id: photoId, kind: photoKind });
    setShowDeletePhotoConfirm(true);
  };

  const confirmDeletePhoto = async (currentPhotoCount: number) => {
    if (!photoToDelete) return;

    setDeletingPhotoId(photoToDelete.id);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/photos/${photoToDelete.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete photo");
      }

      // Optimistically remove the photo from the UI immediately
      setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      const newCount = Math.max(0, currentPhotoCount - 1);

      // Update parent component's photo count immediately
      onPhotoCountChanged?.(lotId, newCount);

      // Close confirmation modal
      setShowDeletePhotoConfirm(false);
      setPhotoToDelete(null);

      // Reload photos in the background to ensure consistency
      await loadPhotos();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to delete photo");
      // On error, reload photos to restore correct state
      await loadPhotos();
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return {
    photos,
    loadingPhotos,
    deletingPhotoId,
    showDeletePhotoConfirm,
    photoToDelete,
    dragOverKind,
    uploadingKind,
    loadPhotos,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    downloadImage,
    downloadAllImages,
    handleDeletePhoto,
    confirmDeletePhoto,
    setShowDeletePhotoConfirm,
    setPhotoToDelete,
  };
}
