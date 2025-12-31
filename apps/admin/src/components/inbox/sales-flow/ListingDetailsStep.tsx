"use client";

import { InboxLot, SalesData } from "./types";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";

interface Props {
  lot: InboxLot;
  salesData: SalesData | null;
  loadingSalesData: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
}

export default function ListingDetailsStep({
  lot,
  salesData,
  loadingSalesData,
  onUpdateTitle,
  onUpdateDescription,
}: Props) {
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
          Listing Title
        </label>
        <textarea
          value={salesData.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
          placeholder="Enter listing title..."
        />
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

