"use client";

import { useState, useEffect } from "react";
import { CONDITIONS, Condition } from "../types";
import type { DraftLine } from "./types";
import SplitModal from "@/components/ui/SplitModal";
import { CARD_VARIATIONS, variationLabel } from "@/components/inventory/variations";

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
  const [allowedVariations, setAllowedVariations] = useState<string[]>(CARD_VARIATIONS as string[]);
  const [loadingVariants, setLoadingVariants] = useState(false);

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

  // Load allowed variants from TCGdex and snap if invalid
  useEffect(() => {
    let active = true;
    const loadVariants = async () => {
      setLoadingVariants(true);
      try {
        const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(line.card_id)}`);
        const json = await res.json();
        const variants = json?.variants;
        if (!variants || typeof variants !== "object") throw new Error("No variants");
        const map: Array<{ key: string; value: string }> = [
          { key: "normal", value: "standard" },
          { key: "holo", value: "holo" },
          { key: "reverse", value: "reverse_holo" },
          { key: "firstEdition", value: "first_edition" },
          { key: "wPromo", value: "promo" },
        ];
        const next = map.filter((m) => variants[m.key] === true).map((m) => m.value);
        const nextAllowed = next.length ? next : ["standard"];
        if (active) {
          setAllowedVariations(nextAllowed);
          if (!nextAllowed.includes(line.variation || "standard")) {
            await onUpdate(line.id, { variation: nextAllowed[0] });
          }
        }
      } catch (e) {
        console.warn("Variant load failed, using defaults", e);
        if (active) setAllowedVariations(CARD_VARIATIONS as string[]);
      } finally {
        if (active) setLoadingVariants(false);
      }
    };
    void loadVariants();
    return () => {
      active = false;
    };
  }, [line.card_id, line.variation, onUpdate, line.id]);

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
        <div className="col-span-2">
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

        {/* Variation */}
        <div className="col-span-2">
          <select
            className="w-full rounded border border-black/10 px-2 py-1.5 text-xs bg-white font-medium text-black"
            value={line.variation || "standard"}
            onChange={(e) => onUpdate(line.id, { variation: e.target.value })}
            disabled={loadingVariants}
          >
            {allowedVariations.map(v => (
              <option key={v} value={v}>{variationLabel(v)}</option>
            ))}
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
              })
            }
            className="w-4 h-4"
          />
        </div>

        {/* Actions */}
        <div className="col-span-3 flex items-center gap-1">
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

