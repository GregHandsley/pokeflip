"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  photoKind: string | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeletePhotoModal({
  isOpen,
  onClose,
  photoKind,
  onConfirm,
  isDeleting,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Photo Deletion"
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Photo"}
          </Button>
        </div>
      }
    >
      {photoKind && (
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to delete this <strong>{photoKind}</strong> photo? This
            action cannot be undone.
          </p>
          <p className="text-xs text-gray-500">
            The photo will be permanently removed from storage and cannot be recovered.
          </p>
        </div>
      )}
    </Modal>
  );
}

