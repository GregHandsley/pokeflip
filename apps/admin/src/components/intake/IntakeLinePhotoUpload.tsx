"use client";

import { useState, useRef } from "react";
import Button from "@/components/ui/Button";

interface Props {
  lineId: string;
  kind: "front" | "back" | "extra";
  onUploaded: (photo: { id: string; kind: string; signedUrl: string | null }) => void;
}

export default function IntakeLinePhotoUpload({ lineId, kind, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation (server will also validate)
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("File size exceeds 10MB limit");
      return;
    }
    
    // Validate allowed image types
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload via server (more secure for private buckets)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      const uploadRes = await fetch(`/api/admin/intake-lines/${lineId}/photos/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error || "Upload failed");

      // Pass the uploaded photo data to the callback
      if (uploadJson.photo) {
        onUploaded({
          id: uploadJson.photo.id,
          kind: uploadJson.photo.kind,
          signedUrl: uploadJson.photo.signedUrl || null,
        });
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id={`intake-photo-upload-${lineId}-${kind}`}
      />
      <label htmlFor={`intake-photo-upload-${lineId}-${kind}`} className="cursor-pointer">
        <span className="inline-block">
          <Button
            variant="secondary"
            disabled={uploading}
            className="text-xs pointer-events-none"
            onClick={(e) => e.preventDefault()}
          >
            {uploading ? "Uploading..." : `📷 ${kind}`}
          </Button>
        </span>
      </label>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

