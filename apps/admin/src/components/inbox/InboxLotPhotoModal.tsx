"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import LotPhotoUpload from "@/components/inventory/LotPhotoUpload";
import Button from "@/components/ui/Button";
import { logger } from "@/lib/logger";

type InboxLot = {
  lot_id: string;
  card_id: string;
  card_number: string;
  card_name: string;
  set_name: string;
  condition: string;
  use_api_image?: boolean;
  api_image_url?: string | null;
  has_front_photo?: boolean;
  has_back_photo?: boolean;
  has_required_photos?: boolean;
};

interface Props {
  lot: InboxLot | null;
  onClose: () => void;
  onUpdated: () => void;
}

type Photo = {
  id: string;
  kind: string;
  signedUrl: string | null;
};

export default function InboxLotPhotoModal({ lot, onClose, onUpdated }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [useApiImage, setUseApiImage] = useState(false);
  const [updatingApiImage, setUpdatingApiImage] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; kind: string } | null>(null);

  useEffect(() => {
    if (lot) {
      setUseApiImage(lot.use_api_image || false);
      loadPhotos();
    }
  }, [lot?.lot_id]);

  const loadPhotos = async () => {
    if (!lot) return;
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/photos`);
      const json = await res.json();
      if (json.ok) {
        setPhotos(json.photos || []);
      }
    } catch (e) {
      logger.error("Failed to load photos", e, undefined, { lotId: lot?.lot_id });
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handlePhotoUploaded = async (newPhoto: Photo) => {
    setPhotos((prev) => [...prev, newPhoto]);
    await loadPhotos();
    onUpdated();
  };

  const handleDeletePhoto = (photoId: string, photoKind: string) => {
    setPhotoToDelete({ id: photoId, kind: photoKind });
    setShowDeletePhotoConfirm(true);
  };

  const confirmDeletePhoto = async () => {
    if (!photoToDelete || !lot) return;

    setDeletingPhotoId(photoToDelete.id);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/photos/${photoToDelete.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete photo");
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      setShowDeletePhotoConfirm(false);
      setPhotoToDelete(null);
      await loadPhotos();
      onUpdated();
    } catch (e: any) {
      alert(e.message || "Failed to delete photo");
      await loadPhotos();
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleToggleApiImage = async () => {
    if (!lot) return;

    const newValue = !useApiImage;
    setUpdatingApiImage(true);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/use-api-image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_api_image: newValue }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update API image flag");
      }

      setUseApiImage(newValue);
      onUpdated();
    } catch (e: any) {
      alert(e.message || "Failed to update API image flag");
    } finally {
      setUpdatingApiImage(false);
    }
  };

  if (!lot) return null;

  const hasFront = photos.some((p) => p.kind === "front");
  const hasBack = photos.some((p) => p.kind === "back");
  const hasRequiredPhotos = hasFront && hasBack;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Photos: #${lot.card_number} ${lot.card_name}`}
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
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
                  src={`${lot.api_image_url}/low.webp`}
                  alt="API card image"
                  className="h-32 w-auto rounded border border-gray-200"
                />
              </div>
            )}
          </div>
        )}

        {/* Photo Requirements Status */}
        {!useApiImage && (
          <div className={`rounded-lg p-3 ${
            hasRequiredPhotos
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
          }`}>
            <div className="flex items-center gap-2">
              <svg
                className={`w-5 h-5 ${
                  hasRequiredPhotos ? "text-green-600" : "text-yellow-600"
                }`}
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
                    ? "Ready to publish"
                    : "Missing required photos"}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {hasRequiredPhotos
                    ? "You have front and back photos. This lot can be queued for publishing."
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
              <div className="flex gap-2 flex-wrap">
                <LotPhotoUpload
                  lotId={lot.lot_id}
                  kind="front"
                  onUploaded={handlePhotoUploaded}
                />
                <LotPhotoUpload
                  lotId={lot.lot_id}
                  kind="back"
                  onUploaded={handlePhotoUploaded}
                />
                <LotPhotoUpload
                  lotId={lot.lot_id}
                  kind="extra"
                  onUploaded={handlePhotoUploaded}
                />
              </div>
            </div>

            {/* Photo Gallery */}
            {loadingPhotos ? (
              <div className="text-sm text-gray-500">Loading photos...</div>
            ) : photos.length === 0 ? (
              <div className="text-sm text-gray-500">
                No photos uploaded yet. Upload front and back photos above.
              </div>
            ) : (
              <div>
                <h3 className="font-medium text-sm mb-3">Uploaded Photos</h3>
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden"
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
                      <div className="absolute top-1 right-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id, photo.kind);
                          }}
                          disabled={deletingPhotoId === photo.id}
                          className="p-1 bg-white rounded-full shadow-md text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`Delete ${photo.kind} photo`}
                        >
                          {deletingPhotoId === photo.id ? (
                            <svg
                              className="animate-spin h-4 w-4 text-red-600"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Photo Confirmation Modal */}
      <Modal
        isOpen={showDeletePhotoConfirm}
        onClose={() => setShowDeletePhotoConfirm(false)}
        title="Confirm Photo Deletion"
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeletePhotoConfirm(false)}
              disabled={deletingPhotoId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeletePhoto}
              disabled={deletingPhotoId !== null}
            >
              {deletingPhotoId ? "Deleting..." : "Delete Photo"}
            </Button>
          </div>
        }
      >
        {photoToDelete && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Are you sure you want to delete this <strong>{photoToDelete.kind}</strong> photo? This
              action cannot be undone.
            </p>
            <p className="text-xs text-gray-500">
              The photo will be permanently removed from storage and cannot be recovered.
            </p>
          </div>
        )}
      </Modal>
    </Modal>
  );
}

