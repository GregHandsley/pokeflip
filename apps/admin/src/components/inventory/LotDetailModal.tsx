"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import MarkSoldModal from "./MarkSoldModal";
import LotCardInfo from "./LotCardInfo";
import LotDetails from "./LotDetails";
import PhotoSection from "./PhotoSection";
import DeletePhotoModal from "./DeletePhotoModal";
import LotDetailFooter from "./LotDetailFooter";
import { useLotPhotos } from "./hooks/useLotPhotos";
import { useLotStatus } from "./hooks/useLotStatus";
import type { LotDetailModalProps } from "./LotDetailModal.types";

export default function LotDetailModal({
  lot,
  onClose,
  onLotUpdated,
  onPhotoCountChanged,
}: LotDetailModalProps) {
  const [showMarkSoldModal, setShowMarkSoldModal] = useState(false);

  const {
    currentLot,
    useApiImage,
    updatingForSale,
    updatingApiImage,
    handleToggleForSale,
    handleToggleApiImage,
    updatePhotoCount,
  } = useLotStatus(lot, onLotUpdated);

  const {
    photos,
    loadingPhotos,
    deletingPhotoId,
    showDeletePhotoConfirm,
    photoToDelete,
    dragOverKind,
    uploadingKind,
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
  } = useLotPhotos(currentLot.id, (lotId, newCount) => {
    updatePhotoCount(newCount);
    onPhotoCountChanged?.(lotId, newCount);
  });

  // const canMarkAsSold = currentLot.status !== "sold" && currentLot.status !== "archived";
  const canToggleForSale = currentLot.status !== "sold" && currentLot.status !== "archived";

  const handleConfirmDelete = async () => {
    await confirmDeletePhoto(currentLot.photo_count);
  };

  const handleCloseDeleteModal = () => {
    setShowDeletePhotoConfirm(false);
    setPhotoToDelete(null);
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Card Details"
        maxWidth="2xl"
        footer={
          <LotDetailFooter
            lot={currentLot}
            canToggleForSale={canToggleForSale}
            updatingForSale={updatingForSale}
            onToggleForSale={handleToggleForSale}
            onClose={onClose}
          />
        }
      >
        <div className="space-y-4">
          <LotCardInfo lot={currentLot} />
          <LotDetails lot={currentLot} canToggleForSale={canToggleForSale} />
          <PhotoSection
            lotId={currentLot.id}
            cardImageUrl={currentLot.card?.image_url || null}
            useApiImage={useApiImage}
            photos={photos}
            loadingPhotos={loadingPhotos}
            deletingPhotoId={deletingPhotoId}
            dragOverKind={dragOverKind}
            uploadingKind={uploadingKind}
            photoCount={currentLot.photo_count}
            onToggleApiImage={handleToggleApiImage}
            updatingApiImage={updatingApiImage}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e, kind) => handleDrop(e, kind, currentLot.photo_count)}
            onFileSelect={(kind) => handleFileSelect(kind, currentLot.photo_count)}
            onDownload={(photo) => downloadImage(photo, currentLot.card?.name)}
            onDownloadAll={() => downloadAllImages(currentLot.card?.name)}
            onDelete={handleDeletePhoto}
          />
        </div>
      </Modal>

      <DeletePhotoModal
        isOpen={showDeletePhotoConfirm}
        photoToDelete={photoToDelete}
        deletingPhotoId={deletingPhotoId}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      {showMarkSoldModal && (
        <MarkSoldModal
          lot={{
            id: currentLot.id,
            condition: currentLot.condition,
            quantity: currentLot.quantity,
            available_qty: currentLot.available_qty,
            sold_qty: currentLot.sold_qty,
            for_sale: currentLot.for_sale,
            list_price_pence: currentLot.list_price_pence,
            status: currentLot.status,
            card: currentLot.card,
          }}
          onClose={() => setShowMarkSoldModal(false)}
          onSaleCreated={() => {
            setShowMarkSoldModal(false);
            onLotUpdated?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
