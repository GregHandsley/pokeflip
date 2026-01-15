import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { penceToPounds } from "@pokeflip/shared";
import type { Purchase } from "@/components/acquisitions/types";

type ClosePurchaseModalProps = {
  isOpen: boolean;
  closing: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ClosePurchaseModal({
  isOpen,
  closing,
  purchase,
  onClose,
  onConfirm,
}: ClosePurchaseModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Close Purchase"
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="secondary" onClick={onClose} disabled={closing}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={closing}>
            {closing ? "Closing..." : "Close Purchase"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-gray-700">Are you sure you want to close this purchase?</p>
        {purchase && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="font-medium">{purchase.source_name}</div>
            <div className="text-gray-600 mt-1">
              {purchase.source_type} • £{penceToPounds(purchase.purchase_total_pence)}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500">
          Closing a purchase prevents adding new cards to it. You can reopen it later if needed.
        </p>
      </div>
    </Modal>
  );
}
