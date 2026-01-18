"use client";

import type { RefObject } from "react";

type SortOption = "price_desc" | "qty_desc" | "rarity_desc" | "updated_desc";

interface Props {
  includeDraft: boolean;
  onIncludeDraftChange: (value: boolean) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  rarity: string;
  onRarityChange: (value: string) => void;
  minPriceInputId?: string;
  minPriceRef?: RefObject<HTMLInputElement>;
}

export default function InboxFilters({
  includeDraft,
  onIncludeDraftChange,
  sort,
  onSortChange,
  minPrice,
  onMinPriceChange,
  rarity,
  onRarityChange,
  minPriceInputId,
  minPriceRef,
}: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 sticky top-0 z-20">
      <div className="flex flex-wrap items-center gap-4">
        {/* Include Draft Toggle */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDraft}
            onChange={(e) => onIncludeDraftChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span>Include Draft</span>
        </label>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort:</label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="price_desc">Price (High to Low)</option>
            <option value="qty_desc">Quantity (High to Low)</option>
            <option value="rarity_desc">Rarity (High to Low)</option>
            <option value="updated_desc">Recently Updated</option>
          </select>
        </div>

        {/* Min Price Input */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Min Price (£):</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value)}
            placeholder="0.00"
            id={minPriceInputId}
            ref={minPriceRef}
            className="w-24 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Minimum price"
          />
        </div>

        {/* Rarity Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rarity:</label>
          <select
            value={rarity}
            onChange={(e) => onRarityChange(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Rare Holo">Rare Holo</option>
            <option value="Ultra Rare">Ultra Rare</option>
            <option value="Secret Rare">Secret Rare</option>
          </select>
        </div>
      </div>
    </div>
  );
}
