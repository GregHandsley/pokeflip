"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InboxLot, Photo, SalesData, SalesFlowStep } from "./types";
import StepIndicator from "./StepIndicator";
import PhotosStep from "./PhotosStep";
import ListingDetailsStep from "./ListingDetailsStep";
import PricingStep from "./PricingStep";
import DeletePhotoModal from "./DeletePhotoModal";

interface Props {
  lot: InboxLot | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function SalesFlowModal({ lot, onClose, onUpdated }: Props) {
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
  const [itemNumber, setItemNumber] = useState<string>("");
  const [publishQuantity, setPublishQuantity] = useState<number | null>(null);
  const [variation, setVariation] = useState<string>("standard");

  useEffect(() => {
    if (lot) {
      setUseApiImage(lot.use_api_image || false);
      setPublishQuantity(lot.available_qty); // Default to all available
      setVariation(lot.variation || "standard");
      loadPhotos();
      loadSalesData();
    }
  }, [lot?.lot_id]);

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
    if (!lot) return;
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/admin/lots/${lot.lot_id}/photos`);
      const json = await res.json();
      if (json.ok) {
        setPhotos(json.photos || []);
      }
    } catch (e) {
      console.error("Failed to load photos:", e);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadSalesData = async () => {
    if (!lot) return;
    setLoadingSalesData(true);
    try {
      const res = await fetch(`/api/admin/inbox/lots/${lot.lot_id}/sales-data`);
      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load sales data:", res.status, text);
        return;
      }
      const json = await res.json();
      if (json.ok && json.data) {
        setSalesData(json.data);
      } else {
        console.error("Invalid sales data response:", json);
      }
    } catch (e) {
      console.error("Failed to load sales data:", e);
    } finally {
      setLoadingSalesData(false);
    }
  };

  const handlePhotoUploaded = async (newPhoto: Photo) => {
    setPhotos((prev) => [...prev, newPhoto]);
    await loadPhotos();
    onUpdated();
    // Dispatch event to update inbox count in sidebar
    window.dispatchEvent(new CustomEvent("inboxUpdated"));
  };

  const uploadFile = async (file: File, kind: "front" | "back" | "extra") => {
    if (!lot) return;

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
    } catch (e: any) {
      alert(e.message || "Failed to delete photo");
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
    } catch (e: any) {
      alert(e.message || "Failed to update variation");
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
    } catch (e: any) {
      alert(e.message || "Failed to update API image flag");
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
    await updateStatus("listed");
  };

  const updateStatus = async (status: "draft" | "listed") => {
    if (!lot) return;
    setUpdatingStatus(true);
    try {
      const qtyToPublish = publishQuantity ?? lot.available_qty;
      const needsSplit = status === "listed" && qtyToPublish < lot.available_qty;

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
            list_price_pence: lot.list_price_pence, // Keep the same price
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

        // Mark as for_sale and set item_number
        const forSaleRes = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            for_sale: true,
            item_number: itemNumber.trim() || null,
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

        // If marking as listed, also mark as for_sale and set item_number
        if (status === "listed") {
          const forSaleRes = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              for_sale: true,
              item_number: itemNumber.trim() || null,
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
    } catch (e: any) {
      alert(e.message || "Failed to update status");
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

  if (!lot) return null;

  const hasFront = photos.some((p) => p.kind === "front");
  const hasBack = photos.some((p) => p.kind === "back");
  const hasRequiredPhotos = hasFront && hasBack;
  const canProceed = useApiImage || hasRequiredPhotos;

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Sales Flow: #${lot.card_number} ${lot.card_name}`}
        subtitle={lot.set_name}
        maxWidth="6xl"
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
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep("pricing")}
                >
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
                    disabled={updatingStatus || !canProceed}
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

          {currentStep === "details" && (
            <ListingDetailsStep
              lot={lot ? { ...lot, variation } : (lot as any)}
              salesData={salesData}
              loadingSalesData={loadingSalesData}
              onUpdateTitle={(title) =>
                setSalesData((prev) => prev ? { ...prev, title } : null)
              }
              onUpdateDescription={(description) =>
                setSalesData((prev) => prev ? { ...prev, description } : null)
              }
              onUpdateVariation={handleVariationChange}
            />
          )}

          {currentStep === "pricing" && (
            <PricingStep
              lot={lot}
              salesData={salesData}
              loadingSalesData={loadingSalesData}
              itemNumber={itemNumber}
              onItemNumberChange={setItemNumber}
              publishQuantity={publishQuantity ?? undefined}
              onPublishQuantityChange={(qty) => setPublishQuantity(qty)}
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

