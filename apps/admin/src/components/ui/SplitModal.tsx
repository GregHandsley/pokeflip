"use client";

import { useState } from "react";
import Modal from "./Modal";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import { CONDITIONS, Condition } from "@/features/intake/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSplit: (splitQty: number, forSale: boolean, price: string | null, condition?: Condition) => Promise<void>;
  currentQuantity: number;
  currentForSale: boolean;
  currentPrice: number | null;
  currentCondition?: Condition;
  title?: string;
};

export default function SplitModal({
  isOpen,
  onClose,
  onSplit,
  currentQuantity,
  currentForSale,
  currentPrice,
  currentCondition,
  title = "Split Quantity",
}: Props) {
  const [splitQty, setSplitQty] = useState(1);
  const [forSale, setForSale] = useState(currentForSale);
  const [price, setPrice] = useState(currentPrice != null ? penceToPounds(currentPrice) : "");
  const [condition, setCondition] = useState<Condition>(currentCondition || "NM");
  const [splitting, setSplitting] = useState(false);

  const maxSplitQty = currentQuantity - 1; // Can't split all, must leave at least 1
  const remainingQty = currentQuantity - splitQty;

  const handleSplit = async () => {
    if (splitQty < 1 || splitQty >= currentQuantity) {
      return;
    }
    setSplitting(true);
    try {
      await onSplit(
        splitQty,
        forSale,
        forSale && price ? price : null,
        currentCondition ? condition : undefined
      );
      onClose();
      // Reset form
      setSplitQty(1);
      setForSale(currentForSale);
      setPrice(currentPrice != null ? penceToPounds(currentPrice) : "");
    } catch (e) {
      console.error("Split failed:", e);
    } finally {
      setSplitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            onClick={onClose}
            disabled={splitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={splitting || splitQty < 1 || splitQty >= currentQuantity}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {splitting ? "Splitting..." : "Split"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-gray-700">
            Split <strong>{currentQuantity}</strong> card{currentQuantity !== 1 ? "s" : ""} into two separate entries.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to Split Off
            </label>
            <input
              type="number"
              min={1}
              max={maxSplitQty}
              value={splitQty}
              onChange={(e) => setSplitQty(Math.max(1, Math.min(maxSplitQty, Number(e.target.value))))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Original will have <strong>{remainingQty}</strong> card{remainingQty !== 1 ? "s" : ""} remaining
            </p>
          </div>

          {currentCondition && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition (for split)
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forSale}
                onChange={(e) => {
                  setForSale(e.target.checked);
                  if (!e.target.checked) {
                    setPrice("");
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">For Sale</span>
            </label>
          </div>

          {forSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (£)
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                inputMode="decimal"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}


