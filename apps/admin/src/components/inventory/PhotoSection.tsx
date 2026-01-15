import { useState } from "react";
import PhotoDropZone from "@/components/inbox/sales-flow/PhotoDropZone";
import PhotoGallery from "./PhotoGallery";
import type { Photo } from "./LotDetailModal.types";

interface Props {
  lotId: string;
  cardImageUrl: string | null;
  useApiImage: boolean;
  photos: Photo[];
  loadingPhotos: boolean;
  deletingPhotoId: string | null;
  dragOverKind: "front" | "back" | "extra" | null;
  uploadingKind: "front" | "back" | "extra" | null;
  photoCount: number;
  onToggleApiImage: () => void;
  updatingApiImage: boolean;
  onDragOver: (e: React.DragEvent, kind: "front" | "back" | "extra") => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, kind: "front" | "back" | "extra") => void;
  onFileSelect: (kind: "front" | "back" | "extra") => void;
  onDownload: (photo: Photo) => void;
  onDownloadAll: () => void;
  onDelete: (photoId: string, photoKind: string) => void;
}

export default function PhotoSection({
  cardImageUrl,
  useApiImage,
  photos,
  loadingPhotos,
  deletingPhotoId,
  dragOverKind,
  uploadingKind,
  photoCount,
  onToggleApiImage,
  updatingApiImage,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onDownload,
  onDownloadAll,
  onDelete,
}: Props) {
  const [photoSectionExpanded, setPhotoSectionExpanded] = useState(true);

  const hasFrontPhoto = photos.some((p) => p.kind === "front");
  const hasBackPhoto = photos.some((p) => p.kind === "back");

  return (
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
          {photos.length > 0 && photos.length !== photoCount && (
            <span className="text-xs text-green-600">• Updated</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${photoSectionExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {photoSectionExpanded && (
        <div className="mt-4 space-y-4">
          {/* API Image Option */}
          {cardImageUrl && (
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
                    {updatingApiImage
                      ? "Updating..."
                      : useApiImage
                        ? "Using API Image"
                        : "Use API Image"}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Upload zones - only show if not using API image */}
          {!useApiImage && (
            <>
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
                  onFileSelect={() => onFileSelect("front")}
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
                  onFileSelect={() => onFileSelect("back")}
                />

                <PhotoDropZone
                  kind="extra"
                  label="Extra Photo"
                  hasPhoto={false}
                  isUploading={uploadingKind === "extra"}
                  isDragOver={dragOverKind === "extra"}
                  isDisabled={uploadingKind === "extra"}
                  onDragOver={(e) => onDragOver(e, "extra")}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, "extra")}
                  onFileSelect={() => onFileSelect("extra")}
                />
              </div>

              {/* Photo gallery */}
              <PhotoGallery
                photos={photos}
                loadingPhotos={loadingPhotos}
                deletingPhotoId={deletingPhotoId}
                onDownload={onDownload}
                onDownloadAll={onDownloadAll}
                onDelete={onDelete}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
