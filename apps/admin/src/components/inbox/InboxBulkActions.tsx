"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";

interface Props {
  selectedCount: number;
  onQueuePublish: () => void;
  onUpdatePrice: (price: number) => void;
  onMarkNotForSale: () => void;
  onClearSelection: () => void;
}

export default function InboxBulkActions({
  selectedCount,
  onQueuePublish,
  onUpdatePrice,
  onMarkNotForSale,
  onClearSelection,
}: Props) {
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const handleUpdatePrice = () => {
    const price = parseFloat(priceInput);
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }
    onUpdatePrice(price);
    setShowPriceModal(false);
    setPriceInput("");
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            {selectedCount} lot{selectedCount !== 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onQueuePublish}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Queue Publish
            </button>
            <button
              onClick={() => setShowPriceModal(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Update Price
            </button>
            <button
              onClick={onMarkNotForSale}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Mark Not For Sale
            </button>
            <button
              onClick={onClearSelection}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Update Price Modal */}
      <Modal
        isOpen={showPriceModal}
        onClose={() => {
          setShowPriceModal(false);
          setPriceInput("");
        }}
        title="Update List Price"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => {
                setShowPriceModal(false);
                setPriceInput("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdatePrice}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Update Price
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Update the list price for {selectedCount} selected lot{selectedCount !== 1 ? "s" : ""}.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Price (£)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

