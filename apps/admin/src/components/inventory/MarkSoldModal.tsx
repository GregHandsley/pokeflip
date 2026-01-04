"use client";

import { useState, useEffect } from "react";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ErrorModal from "@/components/ui/ErrorModal";

type Lot = {
  id: string;
  condition: string;
  variation?: string | null;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  card?: {
    id: string;
    number: string;
    name: string;
    set?: {
      name: string;
    } | null;
  } | null;
};

interface Props {
  lot: Lot;
  onClose: () => void;
  onSaleCreated: () => void;
}

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


export default function MarkSoldModal({ lot, onClose, onSaleCreated }: Props) {
  // Initialize quantity to available quantity, or 1 if none available
  const [qty, setQty] = useState(Math.max(1, lot.available_qty || 1));
  const [soldPrice, setSoldPrice] = useState<string>("");
  const [buyerHandle, setBuyerHandle] = useState("");
  const [orderGroup, setOrderGroup] = useState("");
  const [fees, setFees] = useState<string>("");
  const [shipping, setShipping] = useState<string>("");
  const [existingBuyers, setExistingBuyers] = useState<Buyer[]>([]);
  const [buyerSuggestions, setBuyerSuggestions] = useState<Buyer[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [showBuyerSuggestions, setShowBuyerSuggestions] = useState(false);
  const [existingOrderGroups, setExistingOrderGroups] = useState<string[]>([]);
  const [showOrderGroupSuggestions, setShowOrderGroupSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [selectedConsumables, setSelectedConsumables] = useState<ConsumableSelection[]>([]);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: "" });
  const [autoGenerateOrderNumber, setAutoGenerateOrderNumber] = useState(true);

  const [cardInfo, setCardInfo] = useState<{
    number: string;
    name: string;
    set?: { name: string } | null;
  } | null>(null);

  useEffect(() => {
    // Set default sold price to list price if available
    if (lot.list_price_pence != null && !soldPrice) {
      setSoldPrice(penceToPounds(lot.list_price_pence).toString());
    }
    // Load existing buyers and order groups
    loadBuyers();
    loadOrderGroups();
    loadConsumables();
    // Load card info if not provided
    if (!lot.card) {
      loadCardInfo();
    } else {
      setCardInfo({
        number: lot.card.number,
        name: lot.card.name,
        set: lot.card.set,
      });
    }
    // Auto-generate order number
    if (autoGenerateOrderNumber) {
      generateOrderNumber();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot]);

  const loadCardInfo = async () => {
    try {
      const res = await fetch(`/api/admin/lots/${lot.id}/card-info`);
      const json = await res.json();
      if (json.ok && json.card) {
        setCardInfo(json.card);
      }
    } catch (e) {
      console.error("Failed to load card info:", e);
    }
  };

  const loadBuyers = async () => {
    try {
      const res = await fetch("/api/admin/buyers");
      const json = await res.json();
      if (json.ok) {
        setExistingBuyers(json.buyers || []);
      }
    } catch (e) {
      console.error("Failed to load buyers:", e);
    }
  };

  const loadOrderGroups = async () => {
    try {
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok) {
        setExistingOrderGroups(json.orderGroups || []);
      }
    } catch (e) {
      console.error("Failed to load order groups:", e);
    }
  };

  const generateOrderNumber = async () => {
    try {
      // Get the latest order number
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok && json.orderGroups) {
        const existingGroups = json.orderGroups.filter((g: string) => /^ORDER-\d+$/.test(g));
        if (existingGroups.length > 0) {
          const numbers = existingGroups.map((g: string) => parseInt(g.replace("ORDER-", ""), 10));
          const maxNum = Math.max(...numbers);
          setOrderGroup(`ORDER-${maxNum + 1}`);
        } else {
          setOrderGroup("ORDER-1");
        }
      } else {
        setOrderGroup("ORDER-1");
      }
    } catch (e) {
      console.error("Failed to generate order number:", e);
      setOrderGroup("ORDER-1");
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

  const handleOrderGroupChange = (value: string) => {
    setOrderGroup(value);
    
    if (value.length > 0) {
      const filtered = existingOrderGroups.filter((g) =>
        g.toLowerCase().includes(value.toLowerCase())
      );
      setShowOrderGroupSuggestions(filtered.length > 0);
    } else {
      setShowOrderGroupSuggestions(false);
    }
  };

  const loadConsumables = async () => {
    setLoadingConsumables(true);
    try {
      const res = await fetch("/api/admin/consumables");
      const json = await res.json();
      if (json.ok) {
        setConsumables(json.consumables || []);
      }
    } catch (e) {
      console.error("Failed to load consumables:", e);
    } finally {
      setLoadingConsumables(false);
    }
  };


  const applyPackagingRule = async (cardCount: number) => {
    try {
      const res = await fetch("/api/admin/packaging-rules/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_count: cardCount }),
      });

      const json = await res.json();
      if (json.ok && json.consumables) {
        // Map to consumable selections with costs
        const selections: ConsumableSelection[] = json.consumables.map((c: any) => {
          const consumable = consumables.find((cons) => cons.consumable_id === c.consumable_id);
          return {
            consumable_id: c.consumable_id,
            consumable_name: c.consumable_name,
            qty: c.qty,
            unit_cost_pence: consumable?.avg_cost_pence_per_unit || 0,
          };
        });
        setSelectedConsumables(selections);
      }
    } catch (e) {
      console.error("Failed to apply packaging rule:", e);
    }
  };

  // Auto-apply packaging rule when quantity changes
  useEffect(() => {
    if (qty > 0 && consumables.length > 0) {
      applyPackagingRule(qty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, consumables.length]);

  // Update quantity if it exceeds available quantity (e.g., if lot data changes)
  useEffect(() => {
    if (qty > lot.available_qty) {
      setQty(Math.max(1, lot.available_qty));
    }
  }, [lot.available_qty, qty]);

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

  const handleUpdateConsumable = (index: number, field: keyof ConsumableSelection, value: any) => {
    const updated = [...selectedConsumables];
    if (field === "consumable_id") {
      const consumable = consumables.find((c) => c.consumable_id === value);
      updated[index] = {
        ...updated[index],
        consumable_id: value,
        consumable_name: consumable?.name || "",
        unit_cost_pence: consumable?.avg_cost_pence_per_unit || 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSelectedConsumables(updated);
  };

  // Calculate profit
  const calculateProfit = () => {
    const revenue = parseFloat(soldPrice) || 0;
    const feesCost = parseFloat(fees) || 0;
    const shippingCost = parseFloat(shipping) || 0;
    // Consumables cost: qty * unit_cost_pence (in pence) / 100 to get pounds
    const consumablesCost = selectedConsumables.reduce(
      (sum, c) => sum + (c.qty * c.unit_cost_pence) / 100,
      0
    );
    const totalCosts = feesCost + shippingCost + consumablesCost;
    const netProfit = revenue - totalCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const breakEven = totalCosts;

    return {
      revenue,
      feesCost,
      shippingCost,
      consumablesCost,
      totalCosts,
      netProfit,
      margin,
      breakEven,
    };
  };

  const profit = calculateProfit();

  const handleSubmit = async () => {
    if (!soldPrice || parseFloat(soldPrice) <= 0) {
      setErrorModal({ isOpen: true, message: "Please enter a valid sold price" });
      return;
    }

    if (qty <= 0 || qty > lot.available_qty) {
      setErrorModal({ isOpen: true, message: `Quantity must be between 1 and ${lot.available_qty}` });
      return;
    }

    if (!buyerHandle.trim()) {
      setErrorModal({ isOpen: true, message: "Please enter a buyer handle" });
      return;
    }

    // Check for duplicate order numbers if provided
    if (orderGroup.trim()) {
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok && json.orderGroups) {
        const existing = json.orderGroups.find((g: string) => g === orderGroup.trim());
        if (existing) {
          setErrorModal({ isOpen: true, message: `Order number "${orderGroup.trim()}" already exists. Please use a different number.` });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Sell from this lot only
      const lotQuantities = [{ lotId: lot.id, qty }];

      // Create sales for each lot
      const res = await fetch("/api/admin/sales/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lots: lotQuantities,
          soldPricePence: Math.round(parseFloat(soldPrice) * 100),
          buyerHandle: buyerHandle.trim(),
          orderGroup: orderGroup.trim() || null,
          feesPence: fees ? Math.round(parseFloat(fees) * 100) : null,
          shippingPence: shipping ? Math.round(parseFloat(shipping) * 100) : null,
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
        throw new Error(json.error || "Failed to create sale");
      }

      onSaleCreated();
      onClose();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to create sale" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Mark as Sold"
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating Sale..." : "Mark as Sold"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Lot Info */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-sm">
            <div className="font-medium mb-2">
              {cardInfo ? `#${cardInfo.number} ${cardInfo.name}` : lot.card ? `#${lot.card.number} ${lot.card.name}` : "Lot"}
            </div>
            {(cardInfo?.set || lot.card?.set) && (
              <div className="text-gray-600 text-xs mb-1">
                {(cardInfo?.set || lot.card?.set)?.name}
              </div>
            )}
            <div className="text-gray-600 text-xs mb-2">
              Condition: {lot.condition}{" "}
              {lot.variation && `| Variation: ${lot.variation}`} | Total Quantity: {lot.quantity} | Sold: {lot.sold_qty}
            </div>
            <div className="bg-blue-100 border border-blue-300 rounded px-3 py-2 text-sm font-semibold text-blue-900">
              Available to Sell: {lot.available_qty} {lot.available_qty !== 1 ? "copies" : "copy"}
            </div>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity Sold
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max={lot.available_qty}
              value={qty.toString()}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= lot.available_qty) {
                  setQty(val);
                }
              }}
              className="w-full"
            />
            <span className="text-sm text-gray-600 whitespace-nowrap">
              of {lot.available_qty} available
            </span>
          </div>
          {lot.available_qty > 1 && (
            <p className="text-xs text-gray-600 mt-1">
              You can sell up to {lot.available_qty} {lot.available_qty !== 1 ? "copies" : "copy"} at once
            </p>
          )}
        </div>

        {/* Sold Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Sale Price (£)
            <span className="text-xs font-normal text-gray-500 ml-2">
              (for all {qty} {qty !== 1 ? "items" : "item"})
            </span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={soldPrice}
            onChange={(e) => setSoldPrice(e.target.value)}
            placeholder="0.00"
            className="w-full"
          />
          {soldPrice && parseFloat(soldPrice) > 0 && qty > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              Price per item: £{(parseFloat(soldPrice) / qty).toFixed(2)}
            </p>
          )}
        </div>

        {/* Buyer Handle */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buyer Handle
          </label>
          <Input
            type="text"
            value={buyerHandle}
            onChange={(e) => handleBuyerHandleChange(e.target.value)}
            onFocus={() => {
              if (buyerHandle.length > 0) {
                setShowBuyerSuggestions(true);
              }
            }}
            placeholder="Enter buyer handle"
            className="w-full"
          />
          {selectedBuyer && (
            <div className="mt-1 text-xs text-gray-600">
              {selectedBuyer.order_count ? (
                <>
                  Repeat buyer: {selectedBuyer.order_count} order{selectedBuyer.order_count !== 1 ? "s" : ""}
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

        {/* Order Group */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Order Group <span className="text-gray-500">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoGenOrder"
                checked={autoGenerateOrderNumber}
                onChange={(e) => {
                  setAutoGenerateOrderNumber(e.target.checked);
                  if (e.target.checked) {
                    generateOrderNumber();
                  } else {
                    setOrderGroup("");
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="autoGenOrder" className="text-xs text-gray-600">
                Auto-generate
              </label>
            </div>
          </div>
          <Input
            type="text"
            value={orderGroup}
            onChange={(e) => {
              handleOrderGroupChange(e.target.value);
              setAutoGenerateOrderNumber(false);
            }}
            onFocus={() => {
              if (orderGroup.length > 0 && existingOrderGroups.length > 0) {
                setShowOrderGroupSuggestions(true);
              }
            }}
            placeholder="Enter or select order group"
            className="w-full"
            list="order-groups"
          />
          {existingOrderGroups.length > 0 && (
            <datalist id="order-groups">
              {existingOrderGroups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          )}
        </div>

        {/* Multi-Card Sale Placeholder */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Future Feature:</strong> Add multiple cards to a single sale order. This will allow grouping multiple lots into one order.
          </p>
        </div>

        {/* Fees */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fees (£) <span className="text-gray-500">(optional)</span>
          </label>
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

        {/* Shipping */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shipping (£) <span className="text-gray-500">(optional)</span>
          </label>
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

        {/* Consumables */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Packaging Consumables
            </label>
            <Button variant="secondary" size="sm" onClick={handleAddConsumable}>
              Add Consumable
            </Button>
          </div>
          {loadingConsumables ? (
            <div className="text-sm text-gray-500">Loading consumables...</div>
          ) : selectedConsumables.length === 0 ? (
            <div className="text-sm text-gray-400 italic">No consumables added</div>
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
                    onChange={(e) => handleUpdateConsumable(index, "qty", parseInt(e.target.value, 10) || 1)}
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profit Calculation */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <h3 className="font-semibold text-sm">Profit Calculation</h3>
          
          {/* Minimum Price Warning */}
          {soldPrice && parseFloat(soldPrice) < profit.breakEven && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <div className="font-medium text-yellow-800">Price Below Break-Even</div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Break-even price: £{profit.breakEven.toFixed(2)}. Current price may result in a loss.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Revenue:</span>
              <span className="font-medium">£{profit.revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Costs:</span>
              <span className="font-medium text-red-600">-£{profit.totalCosts.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-500 pl-4 space-y-1">
              <div className="flex justify-between">
                <span>Fees:</span>
                <span>£{profit.feesCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span>£{profit.shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Consumables:</span>
                <span>£{profit.consumablesCost.toFixed(2)}</span>
              </div>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between">
              <span className="font-semibold">Net Profit:</span>
              <span className={`font-bold ${profit.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                £{profit.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Margin:</span>
              <span className={`font-medium ${profit.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                {profit.margin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>

    {/* Error Modal */}
    <ErrorModal
      isOpen={errorModal.isOpen}
      onClose={() => setErrorModal({ isOpen: false, message: "" })}
      message={errorModal.message}
    />
    </>
  );
}

