"use client";

import { useEffect, useState } from "react";
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
  const [marketPricePence, setMarketPricePence] = useState<number | null>(null);
  const [marketStatus, setMarketStatus] = useState<"idle" | "loading" | "error">("idle");
  const [marketDetail, setMarketDetail] = useState<any>(null);
  const [aboveFloor, setAboveFloor] = useState(false);
  const [floorGbp, setFloorGbp] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState(
    lot.list_price_pence != null ? penceToPounds(lot.list_price_pence) : ""
  );
  const [savingPrice, setSavingPrice] = useState<"idle" | "saving" | "error" | "success">("idle");

  // Fetch live market snapshot (GBP) for this card
  useEffect(() => {
    let active = true;
    const loadMarket = async () => {
      setMarketStatus("loading");
      try {
        const res = await fetch(`/api/admin/market/prices/${lot.card_id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to fetch market price");
        if (active) {
          const chosen = json?.chosen;
          setMarketPricePence(typeof chosen?.price_pence === "number" ? chosen.price_pence : null);
          setMarketDetail(json);
          setAboveFloor(Boolean(chosen?.above_floor));
          setFloorGbp(typeof chosen?.floor_gbp === "number" ? chosen.floor_gbp : null);
          setMarketStatus("idle");
        }
      } catch (e) {
        console.warn("Market price fetch failed", e);
        if (active) {
          setMarketPricePence(null);
          setMarketDetail(null);
          setAboveFloor(false);
          setFloorGbp(null);
          setMarketStatus("error");
        }
      }
    };
    void loadMarket();
    return () => {
      active = false;
    };
  }, [lot.card_id]);

  const savePrice = async () => {
    setSavingPrice("saving");
    try {
      const value = priceInput.trim();
      const body: any = { for_sale: true };
      if (value === "") {
        body.list_price_pence = null;
      } else {
        const num = Number(value);
        if (Number.isNaN(num) || num < 0) {
          throw new Error("Enter a valid price in GBP (e.g., 1.25)");
        }
        body.list_price_pence = num;
      }

      const res = await fetch(`/api/admin/lots/${lot.lot_id}/for-sale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update price");
      setSavingPrice("success");
      // Reflect locally
      if (body.list_price_pence == null) {
        setPriceInput("");
      } else {
        setPriceInput(value);
      }
    } catch (e) {
      console.warn(e);
      setSavingPrice("error");
    } finally {
      setTimeout(() => setSavingPrice("idle"), 1200);
    }
  };

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
        <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2">
          <div className="text-2xl font-bold text-green-600">
            {lot.list_price_pence != null
              ? `£${penceToPounds(lot.list_price_pence)}`
              : "Not set"}
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Set list price (£)"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-40"
            />
            <button
              type="button"
              onClick={savePrice}
              disabled={savingPrice === "saving"}
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {savingPrice === "saving" ? "Saving…" : "Save price"}
            </button>
            {savingPrice === "error" && (
              <span className="text-xs text-red-600">Failed to save</span>
            )}
            {savingPrice === "success" && (
              <span className="text-xs text-green-600">Saved</span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Leave blank to keep price unset. Set a GBP list price before publishing.
          </p>
        </div>
      </div>

      {/* Pricing Suggestions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pricing Suggestions
        </label>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Market snapshot (GBP):</span>
              <span className="font-semibold text-blue-700">
                {marketStatus === "loading" && "Loading…"}
                {marketStatus === "error" && "Unavailable"}
                {marketStatus === "idle" && marketPricePence != null
                  ? `£${penceToPounds(marketPricePence)}`
                  : marketStatus === "idle" && "Not available"}
              </span>
            </div>

            {marketStatus === "idle" && marketPricePence != null && (
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    aboveFloor ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {aboveFloor ? "Above floor" : "At/below floor"}
                </span>
                {floorGbp != null && (
                  <span className="text-xs text-gray-600">Floor: £{floorGbp.toFixed(2)}</span>
                )}
              </div>
            )}

            {/* Show only one provider: prefer Cardmarket, else TCGplayer */}
            {marketDetail?.cardmarket?.gbp ? (
              <div className="text-xs text-gray-700 space-y-1">
                <div className="font-semibold text-gray-800">Cardmarket (GBP)</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {marketDetail.cardmarket.gbp.avg7 != null && (
                    <span>7-day average: £{penceToPounds(marketDetail.cardmarket.gbp.avg7)}</span>
                  )}
                  {marketDetail.cardmarket.gbp.avg30 != null && (
                    <span>30-day average: £{penceToPounds(marketDetail.cardmarket.gbp.avg30)}</span>
                  )}
                </div>
              </div>
            ) : marketDetail?.tcgplayer?.gbp ? (
              <div className="text-xs text-gray-700 space-y-1">
                <div className="font-semibold text-gray-800">TCGplayer (GBP)</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {marketDetail.tcgplayer.gbp.normal?.market != null && (
                    <span>Normal: £{penceToPounds(marketDetail.tcgplayer.gbp.normal.market)}</span>
                  )}
                  {marketDetail.tcgplayer.gbp.reverse_holofoil?.market != null && (
                    <span>Reverse: £{penceToPounds(marketDetail.tcgplayer.gbp.reverse_holofoil.market)}</span>
                  )}
                  {marketDetail.tcgplayer.gbp.holofoil?.market != null && (
                    <span>Holo: £{penceToPounds(marketDetail.tcgplayer.gbp.holofoil.market)}</span>
                  )}
                </div>
              </div>
            ) : null}

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

