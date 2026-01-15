"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import { logger } from "@/lib/logger";

type Buyer = {
  id: string;
  handle: string;
  platform: string;
  order_count?: number;
  total_spend_pence?: number;
};

type Consumable = {
  consumable_id: string;
  name: string;
  unit: string;
  avg_cost_pence_per_unit: number;
};

type ConsumableSelection = {
  consumable_id: string;
  consumable_name: string;
  qty: number;
  unit_cost_pence: number;
};

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  quantity: number;
  bundle_items: Array<{
    id: string;
    quantity: number;
    inventory_lots: {
      id: string;
      condition: string;
      variation: string | null;
      cards: {
        id: string;
        number: string;
        name: string;
        api_image_url: string | null;
        sets: {
          id: string;
          name: string;
        } | null;
      } | null;
    } | null;
  }>;
};

type Props = {
  bundle: Bundle;
  isOpen: boolean;
  onClose: () => void;
  onBundleSold: () => void;
};

export default function SellBundleModal({ bundle, isOpen, onClose, onBundleSold }: Props) {
  const [buyerHandle, setBuyerHandle] = useState("");
  const [orderGroup, setOrderGroup] = useState("");
  const [fees, setFees] = useState("");
  const [shipping, setShipping] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [existingBuyers, setExistingBuyers] = useState<Buyer[]>([]);
  const [buyerSuggestions, setBuyerSuggestions] = useState<Buyer[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [showBuyerSuggestions, setShowBuyerSuggestions] = useState(false);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [selectedConsumables, setSelectedConsumables] = useState<ConsumableSelection[]>([]);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setBuyerHandle("");
      setOrderGroup("");
      setFees("");
      setShipping("");
      setQuantity("1");
      setError(null);
      setSelectedBuyer(null);
      setShowBuyerSuggestions(false);
      loadBuyers();
      loadConsumables();
    }
  }, [isOpen]);

  const loadBuyers = async () => {
    try {
      const res = await fetch("/api/admin/buyers");
      const json = await res.json();
      if (json.ok) {
        setExistingBuyers(json.buyers || []);
      }
    } catch (e) {
      logger.error("Failed to load buyers for SellBundleModal", e);
    }
  };

  const handleBuyerHandleChange = (value: string) => {
    setBuyerHandle(value);
    setSelectedBuyer(null);
    if (value.length > 0) {
      const filtered = existingBuyers.filter((b) =>
        b.handle.toLowerCase().includes(value.toLowerCase())
      );
      setBuyerSuggestions(filtered.slice(0, 5));
      setShowBuyerSuggestions(true);
    } else {
      setShowBuyerSuggestions(false);
    }
  };

  const handleSelectBuyer = (buyer: Buyer) => {
    setBuyerHandle(buyer.handle);
    setSelectedBuyer(buyer);
    setShowBuyerSuggestions(false);
  };

  const totalCards = bundle.bundle_items.reduce((sum, item) => sum + item.quantity, 0);

  const loadConsumables = async () => {
    setLoadingConsumables(true);
    try {
      const res = await fetch("/api/admin/consumables");
      const json = await res.json();
      if (json.ok) {
        setConsumables(json.consumables || []);
      }
    } catch (e) {
      logger.error("Failed to load consumables", e);
    } finally {
      setLoadingConsumables(false);
    }
  };

  type PackagingRuleConsumable = {
    consumable_id: string;
    consumable_name: string;
    qty: number;
  };

  const applyPackagingRule = useCallback(
    async (cardCount: number) => {
      try {
        const res = await fetch("/api/admin/packaging-rules/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_count: cardCount }),
        });

        const json = await res.json();
        if (json.ok && json.consumables) {
          const selections: ConsumableSelection[] = json.consumables.map(
            (c: PackagingRuleConsumable) => {
              const consumable = consumables.find((cons) => cons.consumable_id === c.consumable_id);
              return {
                consumable_id: c.consumable_id,
                consumable_name: c.consumable_name,
                qty: c.qty,
                unit_cost_pence: consumable?.avg_cost_pence_per_unit || 0,
              };
            }
          );
          setSelectedConsumables(selections);
        }
      } catch (e) {
        logger.error("Failed to apply packaging rule", e);
      }
    },
    [consumables]
  );

  // Auto-apply packaging rule when bundle opens (based on total card count)
  useEffect(() => {
    if (isOpen && totalCards > 0 && consumables.length > 0) {
      applyPackagingRule(totalCards);
    }
  }, [isOpen, totalCards, consumables.length, applyPackagingRule]);

  const handleAddConsumable = () => {
    setSelectedConsumables([
      ...selectedConsumables,
      {
        consumable_id: "",
        consumable_name: "",
        qty: 1,
        unit_cost_pence: 0,
      },
    ]);
  };

  const handleRemoveConsumable = (index: number) => {
    setSelectedConsumables(selectedConsumables.filter((_, i) => i !== index));
  };

  const handleUpdateConsumable = (
    index: number,
    field: keyof ConsumableSelection,
    value: string | number
  ) => {
    const updated = [...selectedConsumables];
    if (field === "consumable_id") {
      const consumable = consumables.find((c) => c.consumable_id === value);
      updated[index] = {
        ...updated[index],
        consumable_id: value as string,
        consumable_name: consumable?.name || "",
        unit_cost_pence: consumable?.avg_cost_pence_per_unit || 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSelectedConsumables(updated);
  };

  const handleSubmit = async () => {
    if (!buyerHandle.trim()) {
      setError("Please enter a buyer handle");
      return;
    }

    setSubmitting(true);
    setError(null);

    const sellQuantity = parseInt(quantity, 10) || 1;
    if (sellQuantity < 1) {
      setError("Quantity must be at least 1");
      setSubmitting(false);
      return;
    }
    if (sellQuantity > (bundle.quantity || 1)) {
      setError(`Cannot sell more than ${bundle.quantity} bundle(s) available`);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/bundles/${bundle.id}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerHandle: buyerHandle.trim(),
          orderGroup: orderGroup.trim() || null,
          quantity: sellQuantity,
          feesPence: fees ? poundsToPence(fees) : null,
          shippingPence: shipping ? poundsToPence(shipping) : null,
          discountPence: null, // Bundles have fixed price
          consumables: selectedConsumables
            .filter((c) => c.consumable_id && c.qty > 0)
            .map((c) => ({
              consumable_id: c.consumable_id,
              qty: c.qty,
            })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to record sale");
      }

      onBundleSold();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to record sale");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate profit breakdown
  const calculateTotals = () => {
    const sellQuantity = parseInt(quantity, 10) || 1;
    const revenue = (bundle.price_pence / 100) * sellQuantity; // Total revenue for quantity being sold
    const feesCost = parseFloat(fees) || 0;
    const shippingCost = parseFloat(shipping) || 0;
    const consumablesCost = selectedConsumables.reduce(
      (sum, c) => sum + (c.qty * c.unit_cost_pence) / 100,
      0
    );
    const totalCosts = feesCost + shippingCost + consumablesCost;
    const netProfit = revenue - totalCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      feesCost,
      shippingCost,
      consumablesCost,
      totalCosts,
      netProfit,
      margin,
    };
  };

  const totals = calculateTotals();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Sale: ${bundle.name}`}
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Recording..." : "Record Sale"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">Bundle Details</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Bundle Price:</span>
              <span className="font-semibold">£{penceToPounds(bundle.price_pence)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Available Quantity:</span>
              <span className="font-semibold">{bundle.quantity || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Cards:</span>
              <span className="font-semibold">{totalCards}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quantity to Sell *</label>
          <Input
            type="number"
            min="1"
            max={bundle.quantity || 1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            className="w-full"
          />
          <p className="mt-1 text-xs text-gray-500">{bundle.quantity || 1} bundle(s) available</p>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Cards in Bundle</h3>
          <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
            {bundle.bundle_items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                {item.inventory_lots?.cards?.api_image_url && (
                  <div className="relative h-10 w-auto rounded border border-gray-200 overflow-hidden">
                    <Image
                      src={`${item.inventory_lots.cards.api_image_url}/low.webp`}
                      alt=""
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    #{item.inventory_lots?.cards?.number} {item.inventory_lots?.cards?.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {item.inventory_lots?.cards?.sets?.name} • Qty: {item.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Handle *</label>
            <Input
              type="text"
              value={buyerHandle}
              onChange={(e) => handleBuyerHandleChange(e.target.value)}
              onFocus={() => {
                if (buyerHandle.length > 0) {
                  setShowBuyerSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding suggestions to allow click events
                setTimeout(() => setShowBuyerSuggestions(false), 200);
              }}
              placeholder="Enter buyer handle"
              className="w-full"
            />
            {selectedBuyer && (
              <div className="mt-1 text-xs text-gray-600">
                {selectedBuyer.order_count ? (
                  <>
                    Repeat buyer: {selectedBuyer.order_count} order
                    {selectedBuyer.order_count !== 1 ? "s" : ""}
                    {selectedBuyer.total_spend_pence != null && (
                      <> • Total spend: £{penceToPounds(selectedBuyer.total_spend_pence)}</>
                    )}
                  </>
                ) : (
                  "New buyer"
                )}
              </div>
            )}
            {showBuyerSuggestions && buyerSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {buyerSuggestions.map((buyer) => (
                  <button
                    key={buyer.id}
                    onClick={() => handleSelectBuyer(buyer)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span className="font-medium">{buyer.handle}</span>
                    {buyer.order_count && (
                      <span className="text-xs text-gray-500">
                        {buyer.order_count} order{buyer.order_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Number <span className="text-gray-500">(optional)</span>
            </label>
            <Input
              type="text"
              value={orderGroup}
              onChange={(e) => setOrderGroup(e.target.value)}
              placeholder="e.g., ORD-0001"
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fees (£)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder="0.00"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping (£)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              placeholder="0.00"
              className="w-full"
            />
          </div>
        </div>

        {/* Consumables */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Packaging Consumables</h3>
            <Button variant="secondary" size="sm" onClick={handleAddConsumable}>
              Add Consumable
            </Button>
          </div>

          {loadingConsumables ? (
            <div className="text-sm text-gray-500">Loading consumables...</div>
          ) : selectedConsumables.length === 0 ? (
            <div className="text-sm text-gray-400 italic">
              No consumables added (auto-applied based on card count)
            </div>
          ) : (
            <div className="space-y-2">
              {selectedConsumables.map((consumable, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <select
                    value={consumable.consumable_id}
                    onChange={(e) => handleUpdateConsumable(index, "consumable_id", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
                  >
                    <option value="">Select consumable...</option>
                    {consumables.map((c) => (
                      <option key={c.consumable_id} value={c.consumable_id}>
                        {c.name} ({c.unit}) - £{penceToPounds(c.avg_cost_pence_per_unit)}/unit
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="1"
                    value={consumable.qty.toString()}
                    onChange={(e) =>
                      handleUpdateConsumable(index, "qty", parseInt(e.target.value, 10) || 1)
                    }
                    className="w-20"
                    placeholder="Qty"
                  />
                  <div className="text-xs text-gray-600 w-24 text-right">
                    £{penceToPounds(consumable.qty * consumable.unit_cost_pence)}
                  </div>
                  <button
                    onClick={() => handleRemoveConsumable(index)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profit Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm mb-3">Profit Breakdown</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Revenue:</span>
              <span className="font-medium">£{totals.revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Fees:</span>
              <span>£{totals.feesCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping:</span>
              <span>£{totals.shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Consumables:</span>
              <span>£{totals.consumablesCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600 border-t border-gray-300 pt-1 mt-1">
              <span>Total Costs:</span>
              <span>£{totals.totalCosts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-gray-300 pt-1 mt-1">
              <span>Net Profit:</span>
              <span className={totals.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                £{totals.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-medium">Margin:</span>
              <span
                className={`text-lg font-bold ${
                  totals.margin >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totals.margin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
