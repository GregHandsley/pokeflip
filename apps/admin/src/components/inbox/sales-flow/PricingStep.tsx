"use client";

import { useState } from "react";
import { penceToPounds } from "@pokeflip/shared";
import { InboxLot, SalesData } from "./types";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { Input } from "@/components/ui/Input";

interface Props {
  lot: InboxLot;
  salesData: SalesData | null;
  loadingSalesData: boolean;
  itemNumber?: string;
  onItemNumberChange?: (itemNumber: string) => void;
  publishQuantity?: number;
  onPublishQuantityChange?: (quantity: number) => void;
}

export default function PricingStep({ 
  lot, 
  salesData, 
  loadingSalesData, 
  itemNumber = "", 
  onItemNumberChange,
  publishQuantity,
  onPublishQuantityChange,
}: Props) {
  if (loadingSalesData) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading pricing information...</div>
      </div>
    );
  }

  if (!salesData) {
    return (
      <div className="text-center py-8 text-gray-600">
        Failed to load pricing information
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

      {/* Current Price */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current List Price
        </label>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {lot.list_price_pence != null
              ? `£${penceToPounds(lot.list_price_pence)}`
              : "Not set"}
          </div>
        </div>
      </div>

      {/* Pricing Suggestions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pricing Suggestions
        </label>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm">
            {salesData.suggestedPrice != null ? (
              <div>
                <span className="text-gray-600">Suggested Price:</span>{" "}
                <span className="font-medium text-lg text-blue-700">
                  £{penceToPounds(salesData.suggestedPrice)}
                </span>
              </div>
            ) : (
              <div className="text-gray-600">
                No pricing suggestions available at this time.
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Pricing suggestions will be available in a future update. This will include market analysis and competitive pricing data.
            </p>
          </div>
        </div>
      </div>

      {/* Publish Quantity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quantity to Publish to eBay
        </label>
        <Input
          type="number"
          min={1}
          max={lot.available_qty}
          value={publishQuantity ?? lot.available_qty}
          onChange={(e) => {
            const qty = Math.max(1, Math.min(lot.available_qty, Number(e.target.value) || 1));
            onPublishQuantityChange?.(qty);
          }}
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          {publishQuantity && publishQuantity < lot.available_qty ? (
            <>
              <strong>{publishQuantity}</strong> card{publishQuantity !== 1 ? "s" : ""} will be published to eBay.
              The remaining <strong>{lot.available_qty - publishQuantity}</strong> card{lot.available_qty - publishQuantity !== 1 ? "s" : ""} will remain in draft status.
            </>
          ) : (
            <>All <strong>{lot.available_qty}</strong> available card{lot.available_qty !== 1 ? "s" : ""} will be published.</>
          )}
        </p>
      </div>

      {/* Item Number / eBay Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Item Number <span className="text-gray-500 text-xs font-normal">(eBay listing number - optional)</span>
        </label>
        <Input
          type="text"
          value={itemNumber}
          onChange={(e) => onItemNumberChange?.(e.target.value)}
          placeholder="e.g., 123456789012"
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Cards with the same item number will be grouped together when marking as sold.
        </p>
      </div>
    </div>
  );
}

