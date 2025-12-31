"use client";

import { useState, useEffect } from "react";
import { penceToPounds } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import PhotoDropZone from "@/components/inbox/sales-flow/PhotoDropZone";

type Lot = {
  id: string;
  card_id: string;
  condition: string;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  use_api_image?: boolean;
  card: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

interface Props {
  lot: Lot;
  onClose: () => void;
  onLotUpdated?: () => void;
  onPhotoCountChanged?: (lotId: string, newCount: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

// Function to determine the display status for a lot
function getDisplayStatus(lot: {
  status: string;
  for_sale: boolean;
}): { label: string; color: string } {
  // Priority 1: Sold/Archived status
  if (lot.status === "sold") {
    return { label: "Sold", color: "bg-purple-100 text-purple-700" };
  }
  if (lot.status === "archived") {
    return { label: "Archived", color: "bg-gray-100 text-gray-500" };
  }

  // Fallback: Show lot status
  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    ready: "bg-blue-100 text-blue-700",
    listed: "bg-green-100 text-green-700",
  };
  return {
    label: lot.status.charAt(0).toUpperCase() + lot.status.slice(1),
    color: statusColors[lot.status] || "bg-gray-100 text-gray-700",
  };
}

export default function LotDetailModal({ lot, onClose, onLotUpdated, onPhotoCountChanged }: Props) {
  const [markingSold, setMarkingSold] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; kind: string; signedUrl: string | null }>>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoSectionExpanded, setPhotoSectionExpanded] = useState(true); // Expanded by default
  const [currentLot, setCurrentLot] = useState(lot);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; kind: string } | null>(null);
  const [showMarkSoldConfirm, setShowMarkSoldConfirm] = useState(false);
  const [updatingForSale, setUpdatingForSale] = useState(false);
  const [useApiImage, setUseApiImage] = useState(false);
  const [updatingApiImage, setUpdatingApiImage] = useState(false);
  const [dragOverKind, setDragOverKind] = useState<"front" | "back" | "extra" | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"front" | "back" | "extra" | null>(null);

  useEffect(() => {
    setCurrentLot(lot);
    setUseApiImage(lot.use_api_image || false);
    loadPhotos();
  }, [lot.id]);

  // Update currentLot when lot prop changes (e.g., from parent refresh)
  useEffect(() => {
    setCurrentLot(lot);
    setUseApiImage(lot.use_api_image || false);
  }, [lot]);

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

  const loadPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/photos`);
      const json = await res.json();
      if (json.ok) {
        const loadedPhotos = json.photos || [];
        setPhotos(loadedPhotos);
        // Update photo count in local state
        setCurrentLot((prev) => ({
          ...prev,
          photo_count: loadedPhotos.length,
        }));
      }
    } catch (e) {
      console.error("Failed to load photos:", e);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handlePhotoUploaded = async (newPhoto: { id: string; kind: string; signedUrl: string | null }) => {
    // Optimistically add the photo to the UI immediately
    setPhotos((prev) => [...prev, newPhoto]);
    const newCount = (currentLot.photo_count || 0) + 1;
    setCurrentLot((prev) => ({
      ...prev,
      photo_count: newCount,
    }));

    // Update parent component's photo count immediately
    onPhotoCountChanged?.(currentLot.id, newCount);

    // Reload photos in the background to ensure consistency and get any additional metadata
    await loadPhotos();
    // Note: We don't call onLotUpdated here to avoid closing the modal
    // The photo count in the parent will update when the modal is closed
  };

  const uploadFile = async (file: File, kind: "front" | "back" | "extra") => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
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

      const uploadRes = await fetch(`/api/admin/lots/${currentLot.id}/photos/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      if (uploadJson.photo) {
        await handlePhotoUploaded({
          id: uploadJson.photo.id,
          kind: uploadJson.photo.kind,
          signedUrl: uploadJson.photo.signedUrl || null,
        });
      }
    } catch (e: any) {
      alert(e.message || "Upload failed");
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

  const handleDrop = async (e: React.DragEvent, kind: "front" | "back" | "extra") => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKind(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file, kind);
    }
  };

  const handleFileSelect = (kind: "front" | "back" | "extra") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await uploadFile(file, kind);
      }
    };
    input.click();
  };

  const downloadImage = async (photo: { id: string; kind: string; signedUrl: string | null }) => {
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
      a.download = `${currentLot.card?.name.replace(/\s+/g, "_") || "card"}_${photo.kind}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Failed to download image:", e);
      alert("Failed to download image");
    }
  };

  const downloadAllImages = async () => {
    if (photos.length === 0) {
      alert("No images to download");
      return;
    }

    for (const photo of photos) {
      await downloadImage(photo);
      // Small delay between downloads to avoid browser blocking
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  const handleDeletePhoto = (photoId: string, photoKind: string) => {
    setPhotoToDelete({ id: photoId, kind: photoKind });
    setShowDeletePhotoConfirm(true);
  };

  const confirmDeletePhoto = async () => {
    if (!photoToDelete) return;

    setDeletingPhotoId(photoToDelete.id);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/photos/${photoToDelete.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete photo");
      }

      // Optimistically remove the photo from the UI immediately
      setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      const newCount = Math.max(0, (currentLot.photo_count || 0) - 1);
      setCurrentLot((prev) => ({
        ...prev,
        photo_count: newCount,
      }));

      // Update parent component's photo count immediately
      onPhotoCountChanged?.(currentLot.id, newCount);

      // Close confirmation modal
      setShowDeletePhotoConfirm(false);
      setPhotoToDelete(null);

      // Reload photos in the background to ensure consistency
      await loadPhotos();
    } catch (e: any) {
      alert(e.message || "Failed to delete photo");
      // On error, reload photos to restore correct state
      await loadPhotos();
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleMarkAsSold = () => {
    setShowMarkSoldConfirm(true);
  };

  const confirmMarkAsSold = async () => {
    setMarkingSold(true);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sold" }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update status");
      }

      // Update local state
      setCurrentLot((prev) => ({ ...prev, status: "sold" as const }));
      setShowMarkSoldConfirm(false);
      onLotUpdated?.();
      onClose();
    } catch (e: any) {
      alert(e.message || "Failed to mark as sold");
    } finally {
      setMarkingSold(false);
    }
  };

  const handleToggleForSale = async () => {
    const newForSale = !currentLot.for_sale;
    setUpdatingForSale(true);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/for-sale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          for_sale: newForSale,
          list_price_pence: newForSale && !currentLot.list_price_pence ? 0.99 : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update for_sale status");
      }

      // Update local state
      setCurrentLot((prev) => ({
        ...prev,
        for_sale: newForSale,
        list_price_pence: newForSale && !prev.list_price_pence ? 99 : prev.list_price_pence,
      }));
      onLotUpdated?.();
    } catch (e: any) {
      alert(e.message || "Failed to update for sale status");
    } finally {
      setUpdatingForSale(false);
    }
  };

  const handleToggleApiImage = async () => {
    const newValue = !useApiImage;
    setUpdatingApiImage(true);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/use-api-image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_api_image: newValue }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update API image flag");
      }

      setUseApiImage(newValue);
      setCurrentLot((prev) => ({
        ...prev,
        use_api_image: newValue,
      }));
      onLotUpdated?.();
    } catch (e: any) {
      alert(e.message || "Failed to update API image flag");
    } finally {
      setUpdatingApiImage(false);
    }
  };

  const canMarkAsSold = currentLot.status !== "sold" && currentLot.status !== "archived";
  const canToggleForSale = currentLot.status !== "sold" && currentLot.status !== "archived";

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Lot Details"
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          {canMarkAsSold && (
            <button
              onClick={handleMarkAsSold}
              disabled={markingSold}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {markingSold ? "Marking..." : "Mark as Sold"}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {currentLot.card && (
          <div className="flex items-start gap-4">
            {currentLot.card.image_url && (
              <img
                src={`${currentLot.card.image_url}/low.webp`}
                alt={`${currentLot.card.name} card`}
                className="h-32 w-auto rounded border border-gray-200"
              />
            )}
            <div className="flex-1">
              <div className="font-medium text-lg">
                <span className="text-gray-500 font-normal">#{currentLot.card.number}</span>{" "}
                {currentLot.card.name}
              </div>
              {currentLot.card.set && (
                <div className="text-sm text-gray-600">{currentLot.card.set.name}</div>
              )}
              {currentLot.card.rarity && (
                <div className="text-xs text-gray-500 mt-1">{currentLot.card.rarity}</div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Condition:</span>
            <span className="font-medium">
              {CONDITION_LABELS[currentLot.condition as keyof typeof CONDITION_LABELS] || currentLot.condition}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Quantity:</span>
            <span className="font-medium">{currentLot.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Available:</span>
            <span className="font-medium text-green-600">{currentLot.available_qty}</span>
          </div>
          {currentLot.sold_qty > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Sold:</span>
              <span className="font-medium text-gray-500">{currentLot.sold_qty}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            {(() => {
              const displayStatus = getDisplayStatus({
                status: currentLot.status,
                for_sale: currentLot.for_sale,
              });
              return (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${displayStatus.color}`}
                  title={`Sale Status: ${displayStatus.label}`}
                >
                  {displayStatus.label}
                </span>
              );
            })()}
          </div>
          {canToggleForSale && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">For Sale:</span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    currentLot.for_sale
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {currentLot.for_sale ? "Yes" : "No"}
                </span>
                <button
                  onClick={handleToggleForSale}
                  disabled={updatingForSale}
                  className="px-3 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingForSale
                    ? "..."
                    : currentLot.for_sale
                    ? "Mark Not For Sale"
                    : "Mark For Sale"}
                </button>
              </div>
            </div>
          )}
          {currentLot.for_sale && currentLot.list_price_pence != null && (
            <div className="flex justify-between">
              <span className="text-gray-600">List Price:</span>
              <span className="font-medium text-green-600">
                £{penceToPounds(currentLot.list_price_pence)}
              </span>
            </div>
          )}
          {currentLot.note && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="text-sm text-gray-600 italic">{currentLot.note}</div>
            </div>
          )}
        </div>

        {/* Photo Section */}
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setPhotoSectionExpanded(!photoSectionExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
              <div className="flex items-center gap-2">
              <span className="text-gray-600 font-medium">Photos</span>
              {useApiImage ? (
                <span className="text-xs text-blue-600 font-medium">(Using API Image)</span>
              ) : (
                <span className="text-xs text-gray-500">({photos.length})</span>
              )}
              {photos.length > 0 && photos.length !== currentLot.photo_count && (
                <span className="text-xs text-green-600">• Updated</span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                photoSectionExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {photoSectionExpanded && (
            <div className="mt-4 space-y-4">
              {/* API Image Option */}
              {currentLot.card?.image_url && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm mb-1">Use API Image</h3>
                      <p className="text-xs text-gray-600">
                        For low quality cards, you can use the API image instead of uploading photos.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useApiImage}
                        onChange={handleToggleApiImage}
                        disabled={updatingApiImage}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm font-medium">
                        {updatingApiImage ? "Updating..." : useApiImage ? "Using API Image" : "Use API Image"}
                      </span>
                    </label>
                  </div>
                  {useApiImage && (
                    <div className="mt-3">
                      <img
                        src={`${currentLot.card.image_url}/low.webp`}
                        alt="API card image"
                        className="h-32 w-auto rounded border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Upload zones - only show if not using API image */}
              {!useApiImage && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {(() => {
                      const hasFrontPhoto = photos.some((p) => p.kind === "front");
                      return (
                        <PhotoDropZone
                          kind="front"
                          label="Front Photo"
                          hasPhoto={hasFrontPhoto}
                          isUploading={uploadingKind === "front"}
                          isDragOver={dragOverKind === "front"}
                          isDisabled={hasFrontPhoto || uploadingKind === "front"}
                          onDragOver={(e) => handleDragOver(e, "front")}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, "front")}
                          onFileSelect={() => handleFileSelect("front")}
                        />
                      );
                    })()}

                    {(() => {
                      const hasBackPhoto = photos.some((p) => p.kind === "back");
                      return (
                        <PhotoDropZone
                          kind="back"
                          label="Back Photo"
                          hasPhoto={hasBackPhoto}
                          isUploading={uploadingKind === "back"}
                          isDragOver={dragOverKind === "back"}
                          isDisabled={hasBackPhoto || uploadingKind === "back"}
                          onDragOver={(e) => handleDragOver(e, "back")}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, "back")}
                          onFileSelect={() => handleFileSelect("back")}
                        />
                      );
                    })()}

                    <PhotoDropZone
                      kind="extra"
                      label="Extra Photo"
                      hasPhoto={false}
                      isUploading={uploadingKind === "extra"}
                      isDragOver={dragOverKind === "extra"}
                      isDisabled={uploadingKind === "extra" ? true : false}
                      onDragOver={(e) => handleDragOver(e, "extra")}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, "extra")}
                      onFileSelect={() => handleFileSelect("extra")}
                    />
                  </div>

                  {/* Photo gallery */}
                  {loadingPhotos ? (
                    <div className="text-sm text-gray-500">Loading photos...</div>
                  ) : photos.length === 0 ? (
                    <div className="text-sm text-gray-500">No photos yet. Upload some above.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">Uploaded Photos</h3>
                        {photos.length > 0 && (
                          <button
                            onClick={downloadAllImages}
                            className="px-3 py-1.5 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            Download All Images
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {photos.map((photo) => {
                          const isDeleting = deletingPhotoId === photo.id;
                          return (
                            <div
                              key={photo.id}
                              className="relative aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden group"
                            >
                              {photo.signedUrl ? (
                                <img
                                  src={photo.signedUrl}
                                  alt={`${photo.kind} photo`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                  Failed to load
                                </div>
                              )}
                              <div className="absolute top-1 left-1">
                                <span className="px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
                                  {photo.kind}
                                </span>
                              </div>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2">
                                <button
                                  onClick={() => downloadImage(photo)}
                                  className="opacity-0 group-hover:opacity-100 bg-white rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg transition-opacity hover:bg-gray-100 cursor-pointer"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePhoto(photo.id, photo.kind);
                                  }}
                                  disabled={isDeleting}
                                  className="opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg transition-opacity hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600">
                          Download images to easily upload them to your eBay listing. Hover over an image to download it individually, or use the "Download All Images" button above.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Photo Confirmation Modal */}
      <Modal
        isOpen={showDeletePhotoConfirm}
        onClose={() => {
          setShowDeletePhotoConfirm(false);
          setPhotoToDelete(null);
        }}
        title="Delete Photo"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => {
                setShowDeletePhotoConfirm(false);
                setPhotoToDelete(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeletePhoto}
              disabled={deletingPhotoId !== null}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingPhotoId ? "Deleting..." : "Delete Photo"}
            </button>
          </div>
        }
      >
        {photoToDelete && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Are you sure you want to delete this <strong>{photoToDelete.kind}</strong> photo? This action cannot be undone.
            </p>
            <p className="text-xs text-gray-500">
              The photo will be permanently removed from storage and cannot be recovered.
            </p>
          </div>
        )}
      </Modal>

      {/* Mark as Sold Confirmation Modal */}
      <Modal
        isOpen={showMarkSoldConfirm}
        onClose={() => setShowMarkSoldConfirm(false)}
        title="Mark as Sold"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setShowMarkSoldConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmMarkAsSold}
              disabled={markingSold}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {markingSold ? "Marking..." : "Mark as Sold"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to mark this lot as sold? This will change the status to "sold" and update the inventory totals.
          </p>
          {currentLot.card && (
            <div className="text-sm text-gray-600">
              <strong>Card:</strong> #{currentLot.card.number} {currentLot.card.name}
            </div>
          )}
          <div className="text-sm text-gray-600">
            <strong>Quantity:</strong> {currentLot.quantity} card{currentLot.quantity !== 1 ? "s" : ""}
          </div>
        </div>
      </Modal>
    </Modal>
  );
}

