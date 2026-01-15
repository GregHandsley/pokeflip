import Modal from "@/components/ui/Modal";
import { penceToPounds } from "@pokeflip/shared";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import type { Lot } from "./CardLotsView.types";

interface Props {
  isOpen: boolean;
  lot: Lot | null;
  isBulk: boolean;
  selectedCount?: number;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteLotModal({
  isOpen,
  lot,
  isBulk,
  selectedCount = 0,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isBulk ? "Delete Multiple Cards" : "Delete Card"}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
          >
            {isBulk
              ? `Delete ${selectedCount} Card${selectedCount !== 1 ? "s" : ""}`
              : "Delete Card"}
          </button>
        </div>
      }
    >
      {isBulk ? (
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{selectedCount}</strong> card
            {selectedCount !== 1 ? "s" : ""}? This action cannot be undone.
          </p>
          <p className="text-xs text-gray-500">
            This will also delete all associated photos, eBay listings, and sales records for these
            cards.
          </p>
        </div>
      ) : lot ? (
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to delete this card? This action cannot be undone.
          </p>
          <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
            <div>
              <span className="font-medium">Condition:</span>{" "}
              {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition}
            </div>
            <div>
              <span className="font-medium">Quantity:</span> {lot.available_qty} / {lot.quantity}
              {lot.sold_qty > 0 && (
                <span className="text-gray-500 ml-1">({lot.sold_qty} sold)</span>
              )}
            </div>
            <div>
              <span className="font-medium">Status:</span> {lot.status}
            </div>
            {lot.for_sale && lot.list_price_pence != null && (
              <div>
                <span className="font-medium">Price:</span> £{penceToPounds(lot.list_price_pence)}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            This will also delete all associated photos, eBay listings, and sales records for this
            card.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
