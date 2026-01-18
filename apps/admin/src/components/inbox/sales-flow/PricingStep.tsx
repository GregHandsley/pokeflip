"use client";

import { useEffect, useState } from "react";
import { penceToPounds } from "@pokeflip/shared";
import { InboxLot, SalesData } from "./types";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { Input } from "@/components/ui/Input";
import { getPackagingConsumablesForCardCount } from "@/lib/packaging/get-packaging-consumables";
import { supabaseBrowser } from "@/lib/supabase/browser";

type MarketPriceResponse = {
  ok: boolean;
  captured_at: string;
  chosen?: {
    price_pence: number;
    price_gbp: number;
    source: string;
    basis: string;
    above_floor: boolean;
    floor_gbp: number;
  };
  cardmarket?: {
    unit: string;
    updated?: string;
    raw: unknown;
    gbp?: {
      trend?: number;
      avg?: number;
      avg7?: number;
      avg30?: number;
      low?: number;
      trend_holo?: number;
      avg_holo?: number;
      avg7_holo?: number;
      avg30_holo?: number;
      low_holo?: number;
      fx: number;
    };
  };
  tcgplayer?: {
    unit: string;
    updated?: string;
    raw: unknown;
    gbp?: {
      normal?: {
        market?: number;
        mid?: number;
        low?: number;
        high?: number;
      };
      reverse_holofoil?: {
        market?: number;
        mid?: number;
        low?: number;
        high?: number;
      };
      holofoil?: {
        market?: number;
        mid?: number;
        low?: number;
        high?: number;
      };
      fx: number;
    };
  };
};

interface Props {
  lot: InboxLot;
  salesData: SalesData | null;
  loadingSalesData: boolean;
  publishQuantity?: number;
  onPublishQuantityChange?: (quantity: number) => void;
  onPriceInputChange?: (value: string) => void;
  onPriceValidityChange?: (isValid: boolean) => void;
}

export default function PricingStep({
  lot,
  salesData,
  loadingSalesData,
  publishQuantity,
  onPublishQuantityChange,
  onPriceInputChange,
  onPriceValidityChange,
}: Props) {
  const [marketPricePence, setMarketPricePence] = useState<number | null>(null);
  const [marketStatus, setMarketStatus] = useState<"idle" | "loading" | "error">("idle");
  const [marketDetail, setMarketDetail] = useState<MarketPriceResponse | null>(null);
  const [aboveFloor, setAboveFloor] = useState(false);
  const [floorGbp, setFloorGbp] = useState<number | null>(null);
  // Default to 0.99 if no price is set
  const [priceInput, setPriceInput] = useState(
    lot.list_price_pence != null ? penceToPounds(lot.list_price_pence) : "0.99"
  );
  const [consumablesCost, setConsumablesCost] = useState<number>(0);
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [loadingCosts, setLoadingCosts] = useState(false);

  // Fetch consumables costs and delivery cost
  useEffect(() => {
    const loadCosts = async () => {
      setLoadingCosts(true);
      try {
        const cardCount = publishQuantity ?? lot.available_qty;
        const supabase = supabaseBrowser();

        // Get packaging consumables for this card count
        const { consumables: packagingConsumables } = await getPackagingConsumablesForCardCount(
          supabase,
          cardCount
        );

        // Get consumable costs
        if (packagingConsumables.length > 0) {
          const consumableIds = packagingConsumables.map((c) => c.consumable_id);
          const { data: consumableCosts } = await supabase
            .from("v_consumable_costs")
            .select("consumable_id, avg_cost_pence_per_unit")
            .in("consumable_id", consumableIds);

          const totalCostPence = packagingConsumables.reduce((sum, pc) => {
            const cost = (
              consumableCosts as Array<{
                consumable_id: string;
                avg_cost_pence_per_unit: number;
              }> | null
            )?.find((c) => c.consumable_id === pc.consumable_id);
            const unitCost = cost?.avg_cost_pence_per_unit || 0;
            return sum + pc.qty * unitCost;
          }, 0);

          setConsumablesCost(totalCostPence / 100); // Convert to GBP
        } else {
          setConsumablesCost(0);
        }

        // Get delivery cost from settings
        const deliveryRes = await fetch("/api/admin/settings/delivery-cost");
        const deliveryJson = await deliveryRes.json();
        if (deliveryRes.ok) {
          setDeliveryCost(deliveryJson.deliveryCostGbp || 0);
        }
      } catch (e) {
        console.warn("Failed to load costs", e);
        setConsumablesCost(0);
        setDeliveryCost(0);
      } finally {
        setLoadingCosts(false);
      }
    };

    void loadCosts();
  }, [publishQuantity, lot.available_qty]);

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

  useEffect(() => {
    setPriceInput(lot.list_price_pence != null ? penceToPounds(lot.list_price_pence) : "0.99");
  }, [lot.list_price_pence]);

  // Check if price input is valid (not empty and >= 0)
  const isPriceInputValid = () => {
    const value = priceInput.trim();
    if (value === "") return false;
    const num = Number(value);
    return !Number.isNaN(num) && num >= 0;
  };

  useEffect(() => {
    onPriceInputChange?.(priceInput);
    // Calculate validity inline to avoid dependency warning
    const value = priceInput.trim();
    const isValid = value !== "" && !Number.isNaN(Number(value)) && Number(value) >= 0;
    onPriceValidityChange?.(isValid);
  }, [priceInput, onPriceInputChange, onPriceValidityChange]);

  const priceInputPence = isPriceInputValid() ? Math.round(Number(priceInput) * 100) : null;

  if (loadingSalesData) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading pricing information...</div>
      </div>
    );
  }

  if (!salesData) {
    return <div className="text-center py-8 text-gray-600">Failed to load pricing information</div>;
  }

  return (
    <div className="space-y-6">
      {/* Card Info Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Card:</span>{" "}
            <span className="font-medium">
              #{lot.card_number} {lot.card_name}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Set:</span>{" "}
            <span className="font-medium">{lot.set_name}</span>
          </div>
          <div>
            <span className="text-gray-600">Condition:</span>{" "}
            <span className="font-medium">
              {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition}
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Current List Price</label>
          <div className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Set list price (£)"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full"
            />
            <div className="text-xs text-gray-500">
              Price will be saved when you mark the card as uploaded.
            </div>
          </div>
        </div>

        {/* Publish Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity to Publish to eBay
          </label>
          <div className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
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
            <p className="text-xs text-gray-500">
              {publishQuantity && publishQuantity < lot.available_qty ? (
                <>
                  <strong>{publishQuantity}</strong> card{publishQuantity !== 1 ? "s" : ""} will be
                  published to eBay. The remaining{" "}
                  <strong>{lot.available_qty - publishQuantity}</strong> card
                  {lot.available_qty - publishQuantity !== 1 ? "s" : ""} will remain in draft
                  status.
                </>
              ) : (
                <>
                  All <strong>{lot.available_qty}</strong> available card
                  {lot.available_qty !== 1 ? "s" : ""} will be published.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Pricing Suggestions */}
        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pricing Suggestions
          </label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-1">
            <div className="text-sm space-y-2">
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
                      <span>
                        30-day average: £{penceToPounds(marketDetail.cardmarket.gbp.avg30)}
                      </span>
                    )}
                  </div>
                </div>
              ) : marketDetail?.tcgplayer?.gbp ? (
                <div className="text-xs text-gray-700 space-y-1">
                  <div className="font-semibold text-gray-800">TCGplayer (GBP)</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {marketDetail.tcgplayer.gbp.normal?.market != null && (
                      <span>
                        Normal: £{penceToPounds(marketDetail.tcgplayer.gbp.normal.market)}
                      </span>
                    )}
                    {marketDetail.tcgplayer.gbp.reverse_holofoil?.market != null && (
                      <span>
                        Reverse: £
                        {penceToPounds(marketDetail.tcgplayer.gbp.reverse_holofoil.market)}
                      </span>
                    )}
                    {marketDetail.tcgplayer.gbp.holofoil?.market != null && (
                      <span>
                        Holo: £{penceToPounds(marketDetail.tcgplayer.gbp.holofoil.market)}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Profit Prediction */}
        {priceInputPence != null && (
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profit Prediction
            </label>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 flex-1">
              {loadingCosts ? (
                <div className="text-sm text-gray-600">Calculating costs...</div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Predicted Sale Price:</span>
                    <span className="font-semibold text-gray-900">
                      £{penceToPounds(priceInputPence)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Consumables Cost:</span>
                    <span className="text-red-600">-£{consumablesCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Delivery Cost:</span>
                    <span className="text-red-600">-£{deliveryCost.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-green-200 pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Predicted Profit:</span>
                      <span
                        className={`text-lg font-bold ${
                          priceInputPence / 100 - consumablesCost - deliveryCost >= 0
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        £{(priceInputPence / 100 - consumablesCost - deliveryCost).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Margin:{" "}
                      {(
                        ((priceInputPence / 100 - consumablesCost - deliveryCost) /
                          (priceInputPence / 100)) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
