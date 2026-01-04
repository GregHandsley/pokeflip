"use client";

import { useState } from "react";
import { InboxLot, Photo } from "./types";
import PhotoDropZone from "./PhotoDropZone";
import PhotoGallery from "./PhotoGallery";

interface Props {
  lot: InboxLot;
  photos: Photo[];
  loadingPhotos: boolean;
  useApiImage: boolean;
  updatingApiImage: boolean;
  uploadingKind: "front" | "back" | "extra" | null;
  dragOverKind: "front" | "back" | "extra" | null;
  deletingPhotoId: string | null;
  hasFront: boolean;
  hasBack: boolean;
  hasRequiredPhotos: boolean;
  onToggleApiImage: () => void;
  onUploadFile: (file: File, kind: "front" | "back" | "extra") => void;
  onDragOver: (e: React.DragEvent, kind: "front" | "back" | "extra") => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, kind: "front" | "back" | "extra") => void;
  onDownloadImage: (photo: Photo) => void;
  onDownloadAllImages: () => void;
  onDeletePhoto: (photoId: string, photoKind: string) => void;
}

export default function PhotosStep({
  lot,
  photos,
  loadingPhotos,
  useApiImage,
  updatingApiImage,
  uploadingKind,
  dragOverKind,
  deletingPhotoId,
  hasFront,
  hasBack,
  hasRequiredPhotos,
  onToggleApiImage,
  onUploadFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onDownloadImage,
  onDownloadAllImages,
  onDeletePhoto,
}: Props) {
  const handleFileSelect = (kind: "front" | "back" | "extra") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await onUploadFile(file, kind);
      }
    };
    input.click();
  };

  const hasFrontPhoto = photos.some((p) => p.kind === "front");
  const hasBackPhoto = photos.some((p) => p.kind === "back");

  return (
    <div className="space-y-6">
      {/* API Image Option */}
      {lot.api_image_url && (
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
                onChange={onToggleApiImage}
                disabled={updatingApiImage}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm font-medium">
                {updatingApiImage ? "Updating..." : useApiImage ? "Using API Image" : "Use API Image"}
              </span>
            </label>
          </div>
          {useApiImage && (
            <div className="mt-3 space-y-2">
              <img
                src={`${lot.api_image_url}/low.webp`}
                alt="API card image"
                className="h-32 w-auto rounded border border-gray-200"
              />
              <p className="text-xs text-gray-600">
                Right-click on the image above to save it for your eBay listing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Photo Requirements Status */}
      {!useApiImage && (
        <div
          className={`rounded-lg p-3 ${
            hasRequiredPhotos
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-5 h-5 ${hasRequiredPhotos ? "text-green-600" : "text-yellow-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {hasRequiredPhotos ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              )}
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium">
                {hasRequiredPhotos
                  ? "Ready to proceed"
                  : "Missing required photos"}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {hasRequiredPhotos
                  ? "You have front and back photos. You can proceed to listing details."
                  : `Required: Front photo ${hasFront ? "✓" : "✗"} | Back photo ${hasBack ? "✓" : "✗"}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Section */}
      {!useApiImage && (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-3">Upload Photos</h3>
            
            {/* Drag and Drop Zones - Three in a row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <PhotoDropZone
                kind="front"
                label="Front Photo"
                hasPhoto={hasFrontPhoto}
                isUploading={uploadingKind === "front"}
                isDragOver={dragOverKind === "front"}
                isDisabled={hasFrontPhoto || uploadingKind === "front"}
                onDragOver={(e) => onDragOver(e, "front")}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, "front")}
                onFileSelect={() => handleFileSelect("front")}
              />

              <PhotoDropZone
                kind="back"
                label="Back Photo"
                hasPhoto={hasBackPhoto}
                isUploading={uploadingKind === "back"}
                isDragOver={dragOverKind === "back"}
                isDisabled={hasBackPhoto || uploadingKind === "back"}
                onDragOver={(e) => onDragOver(e, "back")}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, "back")}
                onFileSelect={() => handleFileSelect("back")}
              />

              <PhotoDropZone
                kind="extra"
                label="Extra Photo"
                hasPhoto={false}
                isUploading={uploadingKind === "extra"}
                isDragOver={dragOverKind === "extra"}
                isDisabled={uploadingKind === "extra" ? true : false}
                onDragOver={(e) => onDragOver(e, "extra")}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, "extra")}
                onFileSelect={() => handleFileSelect("extra")}
              />
            </div>
          </div>

          {/* Photo Gallery */}
          <PhotoGallery
            photos={photos}
            loadingPhotos={loadingPhotos}
            lot={lot}
            onDownloadImage={onDownloadImage}
            onDownloadAllImages={onDownloadAllImages}
            onDeletePhoto={onDeletePhoto}
            deletingPhotoId={deletingPhotoId}
          />
        </div>
      )}
    </div>
  );
}


