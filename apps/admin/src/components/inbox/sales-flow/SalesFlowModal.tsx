"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InboxLot, Photo, SalesData, SalesFlowStep } from "./types";
import StepIndicator from "./StepIndicator";
import PhotosStep from "./PhotosStep";
import ListingDetailsStep from "./ListingDetailsStep";
import PricingStep from "./PricingStep";
import DeletePhotoModal from "./DeletePhotoModal";
import { logger } from "@/lib/logger";
import { useToast } from "@/contexts/ToastContext";
import { penceToPounds } from "@pokeflip/shared";

interface Props {
  lot: InboxLot | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function SalesFlowModal({ lot, onClose, onUpdated }: Props) {
  const { showError } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingSalesData, setLoadingSalesData] = useState(false);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [useApiImage, setUseApiImage] = useState(false);
  const [updatingApiImage, setUpdatingApiImage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentStep, setCurrentStep] = useState<SalesFlowStep>("photos");
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; kind: string } | null>(null);
  const [dragOverKind, setDragOverKind] = useState<"front" | "back" | "extra" | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"front" | "back" | "extra" | null>(null);
  const [publishQuantity, setPublishQuantity] = useState<number | null>(null);
  const [variation, setVariation] = useState<string>("standard");
  const [showMenu, setShowMenu] = useState(false);
  const [markingNotForSale, setMarkingNotForSale] = useState(false);
  const [isPriceValid, setIsPriceValid] = useState(false);
  const [priceDraft, setPriceDraft] = useState("0.99");
  const [currentListPricePence, setCurrentListPricePence] = useState<number | null>(null);

  const isValidPriceInput = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return false;
    const num = Number(trimmed);
    return !Number.isNaN(num) && num >= 0;
  }, []);

  const loadPhotos = useCallback(async () => {
    if (!lot) return;
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/photos`);
      const json = await res.json();
      if (json.ok) {
        setPhotos(json.photos || []);
      }
    } catch (e) {
      logger.error("Failed to load photos", e, undefined, { lotId: lot.lot_id });
    } finally {
      setLoadingPhotos(false);
    }
  }, [lot]);

  const loadSalesData = useCallback(async () => {
    if (!lot) return;
    setLoadingSalesData(true);
    try {
      const res = await fetch(`/api/admin/inbox/lots/${lot.lot_id}/sales-data`);
      if (!res.ok) {
        const text = await res.text();
        logger.error(
          "Failed to load sales data",
          new Error(`HTTP ${res.status}: ${text}`),
          undefined,
          {
            lotId: lot.lot_id,
            status: res.status,
          }
        );
        return;
      }
      const json = await res.json();
      if (json.ok && json.data) {
        setSalesData(json.data);
      } else {
        logger.error(
          "Invalid sales data response",
          new Error("Invalid response format"),
          undefined,
          {
            lotId: lot.lot_id,
            response: json,
          }
        );
      }
    } catch (e) {
      logger.error("Failed to load sales data", e, undefined, { lotId: lot.lot_id });
    } finally {
      setLoadingSalesData(false);
    }
  }, [lot]);

  useEffect(() => {
    if (lot) {
      setUseApiImage(lot.use_api_image || false);
      setPublishQuantity(lot.available_qty); // Default to all available
      setVariation(lot.variation || "standard");
      const defaultPrice =
        lot.list_price_pence != null ? penceToPounds(lot.list_price_pence) : "0.99";
      setPriceDraft(defaultPrice);
      setCurrentListPricePence(lot.list_price_pence ?? null);
      // Initialize price validity based on draft price
      setIsPriceValid(isValidPriceInput(defaultPrice));
      loadPhotos();
      loadSalesData();
    }
  }, [lot, loadPhotos, loadSalesData, isValidPriceInput]);

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

  const handlePhotoUploaded = async (newPhoto: Photo) => {
    setPhotos((prev) => [...prev, newPhoto]);
    await loadPhotos();
    onUpdated();
    // Dispatch event to update inbox count in sidebar
    window.dispatchEvent(new CustomEvent("inboxUpdated"));
  };

  const uploadFile = async (file: File, kind: "front" | "back" | "extra") => {
    if (!lot) return;

    // Client-side validation (server will also validate)
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File size exceeds 10MB limit");
      return;
    }

    // Validate allowed image types
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
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

      const uploadRes = await fetch(`/api/admin/lots/${lot.lot_id}/photos/upload`, {
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

  const handleDrop = async (e: React.DragEvent, kind: "front" | "back" | "extra") => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKind(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file, kind);
    }
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
      // Dispatch event to update inbox count in sidebar
      window.dispatchEvent(new CustomEvent("inboxUpdated"));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete photo");
      await loadPhotos();
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleVariationChange = async (value: string) => {
    if (!lot) return;
    setVariation(value);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/variation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variation: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update variation");
      }
      onUpdated();
      // Dispatch event to update inbox count in sidebar
      window.dispatchEvent(new CustomEvent("inboxUpdated"));
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to update variation");
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
      // Dispatch event to update inbox count in sidebar
      window.dispatchEvent(new CustomEvent("inboxUpdated"));
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to update API image flag");
    } finally {
      setUpdatingApiImage(false);
    }
  };

  const handleMarkAsDraft = async () => {
    if (!lot) return;
    await updateStatus("draft");
  };

  const handleMarkAsUploaded = async () => {
    if (!lot) return;
    if (!isPriceValid || !isValidPriceInput(priceDraft)) {
      showError("Price is required. Please set a price before marking as uploaded.");
      return;
    }
    const pricePence = Math.round(Number(priceDraft.trim()) * 100);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          for_sale: true,
          list_price_pence: pricePence,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save price");
      }
      setCurrentListPricePence(pricePence);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      showError(error.message || "Failed to save price");
      return;
    }

    await updateStatus("listed", pricePence);
  };

  const updateStatus = async (status: "draft" | "listed", listPricePence?: number) => {
    if (!lot) return;
    setUpdatingStatus(true);
    try {
      const qtyToPublish = publishQuantity ?? lot.available_qty;
      const needsSplit = status === "listed" && qtyToPublish < lot.available_qty;
      const effectiveListPricePence =
        typeof listPricePence === "number" ? listPricePence : currentListPricePence;

      if (needsSplit) {
        // Split the lot: split off the remaining quantity (stays for sale, in draft/ready status)
        // The original lot will keep the publish quantity and be marked as listed
        const remainingQty = lot.available_qty - qtyToPublish;

        const splitRes = await fetch(`/api/admin/lots/${lot.lot_id}/split`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            split_qty: remainingQty, // Split off the remaining quantity
            for_sale: true, // Remaining lot stays for sale so it appears in inbox
            list_price_pence: effectiveListPricePence, // Keep the same price
            condition: lot.condition,
          }),
        });

        const splitJson = await splitRes.json();
        if (!splitRes.ok) {
          throw new Error(splitJson.error || "Failed to split lot");
        }

        // The original lot now has qtyToPublish quantity
        // Update it to listed status with for_sale = true
        const statusRes = await fetch(`/api/admin/lots/${lot.lot_id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "listed" }),
        });

        const statusJson = await statusRes.json();
        if (!statusRes.ok) {
          throw new Error(statusJson.error || "Failed to update status");
        }

        // Mark as for_sale
        const forSaleRes = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            for_sale: true,
            list_price_pence: effectiveListPricePence ?? undefined,
          }),
        });

        const forSaleJson = await forSaleRes.json();
        if (!forSaleRes.ok) {
          console.warn("Failed to update for_sale status:", forSaleJson.error);
        }
      } else {
        // No split needed - update status normally
        const statusRes = await fetch(`/api/admin/lots/${lot.lot_id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        const statusJson = await statusRes.json();
        if (!statusRes.ok) {
          throw new Error(statusJson.error || "Failed to update status");
        }

        // If marking as listed, also mark as for_sale
        if (status === "listed") {
          const forSaleRes = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              for_sale: true,
              list_price_pence: effectiveListPricePence ?? undefined,
            }),
          });

          const forSaleJson = await forSaleRes.json();
          if (!forSaleRes.ok) {
            console.warn("Failed to update for_sale status:", forSaleJson.error);
          }
        }
      }

      onUpdated();
      // Dispatch event to update inbox count in sidebar
      window.dispatchEvent(new CustomEvent("inboxUpdated"));
      onClose();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const downloadImage = async (photo: Photo) => {
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
      a.download = `${lot?.card_name.replace(/\s+/g, "_")}_${photo.kind}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      logger.error("Failed to download image", e, undefined, {
        lotId: lot?.lot_id,
        photoKind: photo.kind,
      });
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

  const handleMarkNotForSale = async () => {
    if (!lot) return;

    setMarkingNotForSale(true);
    setShowMenu(false);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ for_sale: false }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to mark as not for sale");
      }

      onUpdated();
      onClose();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to mark as not for sale");
    } finally {
      setMarkingNotForSale(false);
    }
  };

  if (!lot) return null;

  const hasFront = photos.some((p) => p.kind === "front");
  const hasBack = photos.some((p) => p.kind === "back");
  const hasRequiredPhotos = hasFront && hasBack;
  const canProceed = useApiImage || hasRequiredPhotos;
  // For pricing step, also require valid price
  const canProceedPricing = canProceed && (currentStep !== "pricing" || isPriceValid);

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Sales Flow: #${lot.card_number} ${lot.card_name}`}
        subtitle={lot.set_name}
        maxWidth="6xl"
        headerAction={
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label="More options"
              disabled={markingNotForSale}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkNotForSale();
                    }}
                    disabled={markingNotForSale}
                    className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {markingNotForSale ? "Marking..." : "Mark Not For Sale"}
                  </button>
                </div>
              </>
            )}
          </div>
        }
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-2">
              {currentStep !== "photos" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (currentStep === "details") setCurrentStep("photos");
                    else if (currentStep === "pricing") setCurrentStep("details");
                  }}
                >
                  Back
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
            <div className="flex gap-2">
              {currentStep === "photos" && (
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep("details")}
                  disabled={!canProceed}
                >
                  Next
                </Button>
              )}
              {currentStep === "details" && (
                <Button variant="primary" onClick={() => setCurrentStep("pricing")}>
                  Next
                </Button>
              )}
              {currentStep === "pricing" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleMarkAsDraft}
                    disabled={updatingStatus || !canProceed}
                  >
                    {updatingStatus ? "Saving..." : "Mark as Draft"}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleMarkAsUploaded}
                    disabled={updatingStatus || !canProceedPricing}
                  >
                    {updatingStatus ? "Saving..." : "Mark as Uploaded"}
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <StepIndicator currentStep={currentStep} />

          {currentStep === "photos" && (
            <PhotosStep
              lot={lot}
              photos={photos}
              loadingPhotos={loadingPhotos}
              useApiImage={useApiImage}
              updatingApiImage={updatingApiImage}
              uploadingKind={uploadingKind}
              dragOverKind={dragOverKind}
              deletingPhotoId={deletingPhotoId}
              hasFront={hasFront}
              hasBack={hasBack}
              hasRequiredPhotos={hasRequiredPhotos}
              onToggleApiImage={handleToggleApiImage}
              onUploadFile={uploadFile}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDownloadImage={downloadImage}
              onDownloadAllImages={downloadAllImages}
              onDeletePhoto={handleDeletePhoto}
            />
          )}

          {currentStep === "details" && lot && (
            <ListingDetailsStep
              lot={{ ...lot, variation }}
              salesData={salesData}
              loadingSalesData={loadingSalesData}
              onUpdateTitle={(title) => setSalesData((prev) => (prev ? { ...prev, title } : null))}
              onUpdateDescription={(description) =>
                setSalesData((prev) => (prev ? { ...prev, description } : null))
              }
              onUpdateVariation={handleVariationChange}
            />
          )}

          {currentStep === "pricing" && (
            <PricingStep
              lot={lot}
              salesData={salesData}
              loadingSalesData={loadingSalesData}
              publishQuantity={publishQuantity ?? undefined}
              onPublishQuantityChange={(qty) => setPublishQuantity(qty)}
              onPriceInputChange={setPriceDraft}
              onPriceValidityChange={setIsPriceValid}
            />
          )}
        </div>
      </Modal>

      <DeletePhotoModal
        isOpen={showDeletePhotoConfirm}
        onClose={() => setShowDeletePhotoConfirm(false)}
        photoKind={photoToDelete?.kind || null}
        onConfirm={confirmDeletePhoto}
        isDeleting={deletingPhotoId !== null}
      />
    </>
  );
}
