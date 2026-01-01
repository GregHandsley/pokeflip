"use client";

import { useEffect, useState } from "react";
import { InboxLot, SalesData } from "./types";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { CARD_VARIATIONS, variationLabel } from "@/components/inventory/variations";

interface Props {
  lot: InboxLot;
  salesData: SalesData | null;
  loadingSalesData: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateVariation: (variation: string) => void;
}

export default function ListingDetailsStep({
  lot,
  salesData,
  loadingSalesData,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateVariation,
}: Props) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [allowedVariations, setAllowedVariations] = useState<string[]>(CARD_VARIATIONS as string[]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [editingVariation, setEditingVariation] = useState(false);

  // Fetch allowed variations from TCGdex for this card
  useEffect(() => {
    let active = true;
    const loadVariants = async () => {
      setLoadingVariants(true);
      try {
        const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(lot.card_id)}`);
        const json = await res.json();
        const variants = json?.variants;
        if (!variants || typeof variants !== "object") {
          throw new Error("No variants field");
        }
        const map: Array<{ key: string; value: string }> = [
          { key: "normal", value: "standard" },
          { key: "holo", value: "holo" },
          { key: "reverse", value: "reverse_holo" },
          { key: "firstEdition", value: "first_edition" },
          { key: "wPromo", value: "promo" },
        ];
        const next = map.filter((m) => variants[m.key] === true).map((m) => m.value);
        const nextAllowed = next.length > 0 ? next : ["standard"];
        if (active) {
          setAllowedVariations(nextAllowed);
          // If current variation not in allowed, snap to first allowed
          if (!nextAllowed.includes(lot.variation || "standard")) {
            onUpdateVariation(nextAllowed[0]);
          }
        }
      } catch (e) {
        console.warn("Failed to load variants; using defaults", e);
        if (active) {
          setAllowedVariations(CARD_VARIATIONS as string[]);
        }
      } finally {
        if (active) setLoadingVariants(false);
      }
    };
    void loadVariants();
    return () => {
      active = false;
    };
  }, [lot.card_id, lot.variation, onUpdateVariation]);

  if (loadingSalesData) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading listing details...</div>
      </div>
    );
  }

  if (!salesData) {
    return (
      <div className="text-center py-8 text-gray-600">
        Failed to load listing details
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card Info Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Card:</span>{" "}
            <span className="font-medium">#{lot.card_number} {lot.card_name}</span>
          </div>
          <div>
            <span className="text-gray-600">Set:</span>{" "}
            <span className="font-medium">{lot.set_name}</span>
          </div>
          <div>
            <span className="text-gray-600">Condition:</span>{" "}
            <span className="font-medium">
              {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] ||
                lot.condition}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Variation:</span>{" "}
            <span className="font-medium">{variationLabel(lot.variation)}</span>
          </div>
          <div>
            <span className="text-gray-600">Quantity:</span>{" "}
            <span className="font-medium">{lot.available_qty}</span>
          </div>
          {lot.rarity && (
            <div>
              <span className="text-gray-600">Rarity:</span>{" "}
              <span className="font-medium">{lot.rarity}</span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Variation
        </label>
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-2 rounded border text-sm bg-gray-50 text-gray-800">
            {variationLabel(lot.variation)}
          </span>
          <button
            type="button"
            onClick={() => setEditingVariation((p) => !p)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {editingVariation ? "Cancel" : "Edit variant"}
          </button>
          {loadingVariants && <span className="text-xs text-gray-500">Loading…</span>}
        </div>
        {editingVariation && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {allowedVariations.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onUpdateVariation(v)}
                className={`px-3 py-2 rounded border text-sm transition ${
                  lot.variation === v
                    ? "border-black bg-black text-white"
                    : "border-gray-300 hover:border-gray-400 text-gray-700"
                }`}
              >
                {variationLabel(v)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Listing Title
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={salesData.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="Enter listing title..."
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(salesData.title);
                  setCopyStatus("copied");
                  setTimeout(() => setCopyStatus("idle"), 1500);
                } catch (e) {
                  setCopyStatus("error");
                  setTimeout(() => setCopyStatus("idle"), 1500);
                }
              }}
              className="absolute inset-y-0 right-2 my-auto px-2 h-8 rounded border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-100 transition"
              aria-label="Copy listing title"
            >
              {copyStatus === "copied" ? "✓" : copyStatus === "error" ? "!" : "Copy"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          This title will be used for your eBay listing. You can customize it in settings.
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Listing Description
        </label>
        <textarea
          value={salesData.description}
          onChange={(e) => onUpdateDescription(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm"
          placeholder="Enter listing description..."
        />
        <p className="text-xs text-gray-500 mt-1">
          This description will be used for your eBay listing. You can customize the template in settings.
        </p>
      </div>
    </div>
  );
}

