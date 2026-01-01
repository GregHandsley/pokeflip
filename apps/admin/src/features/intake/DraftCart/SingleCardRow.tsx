"use client";

import { useState } from "react";
import { CONDITIONS, Condition } from "../types";
import { poundsToPence, penceToPounds } from "@pokeflip/shared";
import type { DraftLine } from "./types";
import SplitModal from "@/components/ui/SplitModal";

type Props = {
  line: DraftLine;
  cardDisplay: string;
  imageUrl: string | null;
  onUpdate: (id: string, patch: Partial<DraftLine>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onHoverImage: (url: string, name: string, x: number, y: number) => void;
  onLeaveImage: () => void;
};

export function SingleCardRow({ line, cardDisplay, imageUrl, onUpdate, onRemove, onHoverImage, onLeaveImage }: Props) {
  const [showSplitModal, setShowSplitModal] = useState(false);

  const handleSplit = async (splitQty: number, forSale: boolean, price: string | null, condition?: Condition) => {
    try {
      const res = await fetch(`/api/admin/intake-lines/${line.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_qty: splitQty,
          for_sale: forSale,
          list_price_pence: price,
          condition: condition,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to split line");
      }

      // Update the current line's quantity
      await onUpdate(line.id, { quantity: line.quantity - splitQty });
      
      // Trigger a page refresh to show the new split line
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "Failed to split line");
      throw e;
    }
  };

  return (
    <div className="border-b border-black/5 last:border-b-0">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-black/5 transition-colors">
        {/* Camera icon */}
        <div className="col-span-1">
          {imageUrl ? (
            <div
              className="relative"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onHoverImage(imageUrl, cardDisplay, rect.right + 10, rect.top);
              }}
              onMouseLeave={onLeaveImage}
            >
              <button
                type="button"
                className="p-1.5 rounded hover:bg-black/10 transition-colors"
                title="Hover to view card image"
              >
                <svg className="w-4 h-4 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="w-7 h-7"></div>
          )}
        </div>

        {/* Card name */}
        <div className="col-span-3">
          <div className="font-medium text-sm truncate">{cardDisplay}</div>
        </div>

        {/* Condition */}
        <div className="col-span-2">
          <select
            className="w-full rounded border border-black/10 px-2 py-1.5 text-xs bg-white font-medium text-black"
            value={line.condition}
            onChange={(e) => onUpdate(line.id, { condition: e.target.value as Condition })}
          >
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Quantity */}
        <div className="col-span-1">
          <input
            className="w-full rounded border border-black/10 px-2 py-1.5 text-xs"
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onUpdate(line.id, { quantity: Number(e.target.value) })}
          />
        </div>

        {/* For sale */}
        <div className="col-span-1 flex justify-center">
          <input
            type="checkbox"
            checked={line.for_sale}
            onChange={(e) =>
              onUpdate(line.id, {
                for_sale: e.target.checked,
                list_price_pence: e.target.checked ? (line.list_price_pence ?? poundsToPence("0.99")) : null
              })
            }
            className="w-4 h-4"
          />
        </div>

        {/* Price */}
        <div className="col-span-2">
          <input
            className="w-full rounded border border-black/10 px-2 py-1.5 text-xs disabled:opacity-50"
            disabled={!line.for_sale}
            value={line.for_sale ? (line.list_price_pence != null ? penceToPounds(line.list_price_pence) : "") : ""}
            onChange={(e) => onUpdate(line.id, { list_price_pence: poundsToPence(e.target.value) })}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-center gap-1">
          {line.quantity > 1 && (
            <button
              type="button"
              onClick={() => setShowSplitModal(true)}
              className="px-2 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
              title="Split quantity"
            >
              Split
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            className="px-2 py-1.5 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 rounded border border-black/10 transition-colors"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {/* Split Modal */}
      <SplitModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        onSplit={handleSplit}
        currentQuantity={line.quantity}
        currentForSale={line.for_sale}
        currentPrice={line.list_price_pence}
        currentCondition={line.condition}
        title={`Split ${cardDisplay}`}
      />
    </div>
  );
}

