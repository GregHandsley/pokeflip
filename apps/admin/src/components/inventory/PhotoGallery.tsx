import Image from "next/image";
import type { Photo } from "./LotDetailModal.types";

interface Props {
  photos: Photo[];
  loadingPhotos: boolean;
  deletingPhotoId: string | null;
  onDownload: (photo: Photo) => void;
  onDownloadAll: () => void;
  onDelete: (photoId: string, photoKind: string) => void;
}

export default function PhotoGallery({
  photos,
  loadingPhotos,
  deletingPhotoId,
  onDownload,
  onDownloadAll,
  onDelete,
}: Props) {
  if (loadingPhotos) {
    return <div className="text-sm text-gray-500">Loading photos...</div>;
  }

  if (photos.length === 0) {
    return <div className="text-sm text-gray-500">No photos yet. Upload some above.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Uploaded Photos</h3>
        {photos.length > 0 && (
          <button
            onClick={onDownloadAll}
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
                <Image
                  src={photo.signedUrl}
                  alt={`${photo.kind} photo`}
                  fill
                  className="object-cover"
                  unoptimized
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
                  onClick={() => onDownload(photo)}
                  className="opacity-0 group-hover:opacity-100 bg-white rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg transition-opacity hover:bg-gray-100 cursor-pointer"
                >
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(photo.id, photo.kind);
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
          Download images to easily upload them to your eBay listing. Hover over an image to
          download it individually, or use the &quot;Download All Images&quot; button above.
        </p>
      </div>
    </div>
  );
}
