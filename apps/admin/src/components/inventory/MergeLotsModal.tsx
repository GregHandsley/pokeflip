"use client";

import { useState } from "react";
import { logger } from "@/lib/logger";
import Modal from "@/components/ui/Modal";
import { penceToPounds } from "@pokeflip/shared";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

type Lot = {
  id: string;
  condition: string;
  quantity: number;
  available_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onMerge: (targetLotId: string) => Promise<void>;
  lots: Lot[];
  cardName: string;
};

export default function MergeLotsModal({
  isOpen,
  onClose,
  onMerge,
  lots,
  cardName,
}: Props) {
  const [targetLotId, setTargetLotId] = useState(lots[0]?.id || "");
  const [merging, setMerging] = useState(false);

  const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const totalAvailable = lots.reduce((sum, lot) => sum + lot.available_qty, 0);

  const handleMerge = async () => {
    if (!targetLotId) return;
    setMerging(true);
    try {
      await onMerge(targetLotId);
      onClose();
    } catch (e) {
      logger.error("Failed to merge lots", e, undefined, {
        lotIds: selectedLots,
        targetLotId,
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Merge Lots"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            onClick={onClose}
            disabled={merging}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={merging || !targetLotId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {merging ? "Merging..." : "Merge Lots"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-gray-700">
            Merge <strong>{lots.length}</strong> lot{lots.length !== 1 ? "s" : ""} of{" "}
            <strong>{cardName}</strong> into a single lot.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Total quantity: <strong>{totalQuantity}</strong> ({totalAvailable} available)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Target Lot (other lots will be merged into this one)
          </label>
          <div className="space-y-2">
            {lots.map((lot) => {
              const isSelected = targetLotId === lot.id;
              return (
                <label
                  key={lot.id}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="targetLot"
                    value={lot.id}
                    checked={isSelected}
                    onChange={(e) => setTargetLotId(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        STATUS_COLORS[lot.status] || STATUS_COLORS.draft
                      }`}>
                        {lot.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Quantity: {lot.quantity} ({lot.available_qty} available)
                      {lot.for_sale && lot.list_price_pence != null && (
                        <span className="ml-2">
                          • Price: £{penceToPounds(lot.list_price_pence)}
                        </span>
                      )}
                      {!lot.for_sale && <span className="ml-2">• Not for sale</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> The target lot's settings (for sale, price) will be used for the merged lot.
            Photos from all lots will be combined.
          </p>
        </div>
      </div>
    </Modal>
  );
}

