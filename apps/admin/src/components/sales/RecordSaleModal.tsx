"use client";

import { useState, useEffect } from "react";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ErrorModal from "@/components/ui/ErrorModal";

type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
  quantity: number;
};

type ListedLot = {
  id: string;
  condition: string;
  variation: string;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  list_price_pence: number | null;
  purchases?: Purchase[];
  card: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    api_image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type PurchaseAllocation = {
  purchaseId: string;
  qty: number;
};

type SaleItem = {
  lotId: string;
  lot: ListedLot | null;
  qty: number;
  pricePence: number | null;
  isFree: boolean;
  selectedPurchaseId?: string | null; // Legacy: single purchase selection
  manualAllocation?: boolean; // If true, use purchaseAllocations; if false, auto-allocate
  purchaseAllocations?: PurchaseAllocation[]; // Manual allocation: [{purchaseId, qty}, ...]
};

type PromotionalDeal = {
  id: string;
  name: string;
  description: string | null;
  deal_type: "percentage_off" | "fixed_off" | "free_shipping" | "buy_x_get_y";
  discount_percent: number | null;
  discount_amount_pence: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  min_card_count: number;
  max_card_count: number | null;
  is_active: boolean;
};

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaleCreated: () => void;
}

export default function RecordSaleModal({ isOpen, onClose, onSaleCreated }: Props) {
  const [listedLots, setListedLots] = useState<ListedLot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [promotionalDeals, setPromotionalDeals] = useState<PromotionalDeal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealDiscount, setDealDiscount] = useState<{ type: string; amount: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadListedLots();
      loadBuyers();
      loadOrderGroups();
      loadConsumables();
      loadPromotionalDeals();
      if (autoGenerateOrderNumber) {
        generateOrderNumber();
      }
    } else {
      // Reset state when modal closes
      setSaleItems([]);
      setBuyerHandle("");
      setOrderGroup("");
      setFees("");
      setShipping("");
      setSearchQuery("");
      setSelectedConsumables([]);
      setSelectedDealId(null);
      setDealDiscount(null);
    }
  }, [isOpen]);

  const loadListedLots = async () => {
    setLoadingLots(true);
    try {
      const res = await fetch("/api/admin/sales/listed-lots");
      const json = await res.json();
      if (json.ok) {
        setListedLots(json.lots || []);
      }
    } catch (e) {
      console.error("Failed to load listed lots:", e);
    } finally {
      setLoadingLots(false);
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
      console.error("Failed to load order numbers:", e);
    }
  };

  const generateOrderNumber = async () => {
    try {
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok && json.orderGroups) {
        // Match both old format (ORDER-1) and new format (ORD-0001)
        const existingGroups = json.orderGroups.filter((g: string) => /^(ORDER|ORD)-\d+$/.test(g));
        if (existingGroups.length > 0) {
          const numbers = existingGroups.map((g: string) => {
            const match = g.match(/(?:ORDER|ORD)-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          });
          const maxNum = Math.max(...numbers);
          const nextNum = maxNum + 1;
          setOrderGroup(`ORD-${nextNum.toString().padStart(4, '0')}`);
        } else {
          setOrderGroup("ORD-0001");
        }
      } else {
        setOrderGroup("ORD-0001");
      }
    } catch (e) {
      console.error("Failed to generate order number:", e);
      setOrderGroup("ORD-0001");
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

  const loadPromotionalDeals = async () => {
    try {
      const res = await fetch("/api/admin/promotional-deals");
      const json = await res.json();
      if (json.ok) {
        setPromotionalDeals(json.deals || []);
      }
    } catch (e) {
      console.error("Failed to load promotional deals:", e);
    }
  };

  const addCardToSale = (lot: ListedLot) => {
    // Check if lot is already in sale items
    if (saleItems.some((item) => item.lotId === lot.id)) {
      setErrorModal({ isOpen: true, message: "This card is already in the sale" });
      return;
    }

    const defaultPrice = lot.list_price_pence ? penceToPounds(lot.list_price_pence) : "";
    
    // Create new sale item
    const newItem: SaleItem = {
      lotId: lot.id,
      lot,
      qty: 1,
      pricePence: lot.list_price_pence,
      isFree: false,
      manualAllocation: false, // Auto-allocate by default
      purchaseAllocations: [], // Will be calculated on demand
    };
    
    // Initialize auto-allocation if multiple purchases
    const purchases = lot.purchases || [];
    if (purchases.length > 1) {
      newItem.purchaseAllocations = autoAllocatePurchases(newItem);
    }
    
    setSaleItems([...saleItems, newItem]);
  };

  const removeCardFromSale = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const updateSaleItem = (index: number, field: "qty" | "pricePence" | "isFree" | "selectedPurchaseId" | "manualAllocation" | "purchaseAllocation", value: any) => {
    const updated = [...saleItems];
    if (field === "qty") {
      const qty = parseInt(value, 10) || 1;
      const lot = updated[index].lot;
      if (lot && qty > lot.available_qty) {
        setErrorModal({ isOpen: true, message: `Only ${lot.available_qty} available` });
        return;
      }
      updated[index].qty = Math.max(1, Math.min(qty, lot?.available_qty || 1));
      // Recalculate auto-allocations when qty changes (if not in manual mode)
      if (!updated[index].manualAllocation) {
        const autoAllocs = autoAllocatePurchases(updated[index]);
        updated[index].purchaseAllocations = autoAllocs;
      } else if (updated[index].purchaseAllocations) {
        // In manual mode, adjust allocations to match new qty
        const currentTotal = updated[index].purchaseAllocations.reduce((sum, a) => sum + a.qty, 0);
        if (currentTotal !== updated[index].qty && updated[index].purchaseAllocations.length > 0) {
          const diff = updated[index].qty - currentTotal;
          const lastAlloc = updated[index].purchaseAllocations[updated[index].purchaseAllocations.length - 1];
          lastAlloc.qty = Math.max(0, lastAlloc.qty + diff);
        }
      }
    } else if (field === "pricePence") {
      const pricePounds = parseFloat(value) || 0;
      updated[index].pricePence = pricePounds > 0 ? Math.round(pricePounds * 100) : null;
      // If price is set, uncheck free
      if (pricePounds > 0) {
        updated[index].isFree = false;
      }
    } else if (field === "isFree") {
      updated[index].isFree = value;
      // If marked as free, set price to 0
      if (value) {
        updated[index].pricePence = 0;
      }
    } else if (field === "selectedPurchaseId") {
      updated[index].selectedPurchaseId = value || null;
    } else if (field === "manualAllocation") {
      updated[index].manualAllocation = value;
      // When toggling to manual, initialize allocations if needed
      if (value && !updated[index].purchaseAllocations) {
        const autoAllocs = autoAllocatePurchases(updated[index]);
        updated[index].purchaseAllocations = autoAllocs;
      }
    } else if (field === "purchaseAllocation") {
      // value should be { purchaseId, qty }
      if (!updated[index].purchaseAllocations) {
        updated[index].purchaseAllocations = [];
      }
      const allocs = updated[index].purchaseAllocations!;
      const existingIndex = allocs.findIndex(a => a.purchaseId === value.purchaseId);
      if (value.qty > 0) {
        if (existingIndex >= 0) {
          allocs[existingIndex].qty = value.qty;
        } else {
          allocs.push({ purchaseId: value.purchaseId, qty: value.qty });
        }
      } else {
        // Remove allocation if qty is 0
        if (existingIndex >= 0) {
          allocs.splice(existingIndex, 1);
        }
      }
      // Ensure total matches item qty
      const total = allocs.reduce((sum, a) => sum + a.qty, 0);
      if (total !== updated[index].qty) {
        // Adjust the last allocation to match total qty
        if (allocs.length > 0) {
          const diff = updated[index].qty - total;
          allocs[allocs.length - 1].qty = Math.max(0, allocs[allocs.length - 1].qty + diff);
        }
      }
    }
    setSaleItems(updated);
    // Recalculate deal discount when items change
    if (selectedDealId) {
      calculateDealDiscount(updated, selectedDealId);
    }
  };

  // Auto-allocate purchases based on available quantities
  const autoAllocatePurchases = (item: SaleItem): PurchaseAllocation[] => {
    const purchases = item.lot?.purchases || [];
    if (purchases.length === 0 || purchases.length === 1) {
      // No purchases or single purchase - allocate all to that purchase
      return purchases.length === 1 
        ? [{ purchaseId: purchases[0].id, qty: item.qty }]
        : [];
    }

    // Multiple purchases - distribute proportionally based on available quantities
    const totalAvailable = purchases.reduce((sum, p) => sum + p.quantity, 0);
    if (totalAvailable === 0) return [];

    const allocations: PurchaseAllocation[] = [];
    let remainingQty = item.qty;

    // Sort by quantity (largest first) for more even distribution
    const sortedPurchases = [...purchases].sort((a, b) => b.quantity - a.quantity);

    for (let i = 0; i < sortedPurchases.length && remainingQty > 0; i++) {
      const purchase = sortedPurchases[i];
      const proportion = purchase.quantity / totalAvailable;
      const allocatedQty = i === sortedPurchases.length - 1 
        ? remainingQty // Last purchase gets remaining
        : Math.max(1, Math.floor(item.qty * proportion));
      
      const finalQty = Math.min(allocatedQty, purchase.quantity, remainingQty);
      if (finalQty > 0) {
        allocations.push({ purchaseId: purchase.id, qty: finalQty });
        remainingQty -= finalQty;
      }
    }

    return allocations;
  };

  // Helper function to determine purchase display for a sale item
  const getPurchaseDisplay = (item: SaleItem) => {
    const purchases = item.lot?.purchases || [];
    if (purchases.length === 0) {
      return { type: "none" as const };
    }
    if (purchases.length === 1) {
      // Single purchase - show in small text
      return { 
        type: "single" as const, 
        purchase: purchases[0] 
      };
    }
    
    // Multiple purchases
    const totalAvailable = item.lot?.available_qty || 0;
    
    if (item.qty >= totalAvailable) {
      // All cards being sold - show all purchases in small text
      return { 
        type: "all" as const, 
        purchases 
      };
    }
    
    // Multiple purchases, not all being sold - show allocation controls
    const isManual = item.manualAllocation === true;
    const allocations = isManual 
      ? (item.purchaseAllocations || [])
      : autoAllocatePurchases(item);
    
    return { 
      type: "allocation" as const, 
      purchases,
      isManual,
      allocations,
    };
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

  // Auto-apply packaging rule when total card count changes
  useEffect(() => {
    if (saleItems.length > 0 && consumables.length > 0) {
      const totalCardCount = saleItems.reduce((sum, item) => sum + item.qty, 0);
      if (totalCardCount > 0) {
        applyPackagingRule(totalCardCount);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleItems, consumables.length]);

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

  const calculateDealDiscount = (items: SaleItem[], dealId: string) => {
    const deal = promotionalDeals.find((d) => d.id === dealId);
    if (!deal || !deal.is_active) {
      setDealDiscount(null);
      return;
    }

    const totalCardCount = items.reduce((sum, item) => sum + item.qty, 0);
    const nonFreeItems = items.filter((item) => !item.isFree && item.pricePence && item.pricePence > 0);
    const totalRevenue = nonFreeItems.reduce((sum, item) => sum + (item.pricePence! * item.qty), 0);

    // Check if deal applies (card count requirements)
    if (totalCardCount < deal.min_card_count) {
      setDealDiscount(null);
      return;
    }
    if (deal.max_card_count && totalCardCount > deal.max_card_count) {
      setDealDiscount(null);
      return;
    }

    let discountAmount = 0;

    switch (deal.deal_type) {
      case "percentage_off":
        if (deal.discount_percent) {
          discountAmount = (totalRevenue * deal.discount_percent) / 100;
        }
        break;
      case "fixed_off":
        if (deal.discount_amount_pence) {
          discountAmount = deal.discount_amount_pence;
        }
        break;
      case "free_shipping":
        // This will be handled separately in shipping cost
        discountAmount = 0;
        break;
      case "buy_x_get_y":
        if (deal.buy_quantity && deal.get_quantity && deal.discount_percent != null) {
          // Calculate total quantity
          const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
          
          // Simple: If customer buys buy_quantity cards, get_quantity of those cards are discounted
          // Example: Buy 5 Get 2 100% off = customer adds 5 cards, 2 of those 5 are free
          if (totalQty >= deal.buy_quantity) {
            // Calculate how many complete cycles we can apply
            const cycles = Math.floor(totalQty / deal.buy_quantity);
            const discountedQty = cycles * deal.get_quantity;
            
            if (discountedQty > 0) {
              // Sort items by price (cheapest first) to apply discount to cheapest items
              const sortedItems = [...nonFreeItems].sort((a, b) => (a.pricePence || 0) - (b.pricePence || 0));
              let qtyToDiscount = Math.min(discountedQty, totalQty); // Can't discount more than total cards
              
              for (const item of sortedItems) {
                if (qtyToDiscount <= 0) break;
                const discountThisItem = Math.min(item.qty, qtyToDiscount);
                
                // If discount_percent is 100, the items are free (100% off)
                // Otherwise, apply the percentage discount
                if (deal.discount_percent === 100) {
                  // Make items completely free
                  discountAmount += (item.pricePence! * discountThisItem);
                } else {
                  // Apply percentage discount
                  discountAmount += (item.pricePence! * discountThisItem * deal.discount_percent) / 100;
                }
                
                qtyToDiscount -= discountThisItem;
              }
            }
          }
        }
        break;
    }

    setDealDiscount({
      type: deal.deal_type,
      amount: discountAmount,
    });
  };

  const handleDealChange = (dealId: string | null) => {
    setSelectedDealId(dealId);
    if (dealId) {
      calculateDealDiscount(saleItems, dealId);
    } else {
      setDealDiscount(null);
    }
  };

  // Recalculate discount when sale items change
  useEffect(() => {
    if (selectedDealId && saleItems.length > 0) {
      calculateDealDiscount(saleItems, selectedDealId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleItems, selectedDealId]);

  // Calculate totals
  const calculateTotals = () => {
    const totalRevenue = saleItems.reduce((sum, item) => {
      return sum + (item.pricePence ? (item.pricePence * item.qty) : 0);
    }, 0);
    
    // Apply deal discount
    const discountAmount = dealDiscount?.amount || 0;
    const revenueAfterDiscount = Math.max(0, (totalRevenue / 100) - (discountAmount / 100));
    
    const feesCost = parseFloat(fees) || 0;
    // Apply free shipping discount if deal type is free_shipping
    const shippingCost = (selectedDealId && dealDiscount?.type === "free_shipping") ? 0 : (parseFloat(shipping) || 0);
    const consumablesCost = selectedConsumables.reduce(
      (sum, c) => sum + (c.qty * c.unit_cost_pence) / 100,
      0
    );
    const totalCosts = feesCost + shippingCost + consumablesCost;
    const netProfit = revenueAfterDiscount - totalCosts;
    const margin = revenueAfterDiscount > 0 ? (netProfit / revenueAfterDiscount) * 100 : 0;

    return {
      revenue: totalRevenue / 100,
      discount: discountAmount / 100,
      revenueAfterDiscount,
      feesCost,
      shippingCost,
      consumablesCost,
      totalCosts,
      netProfit,
      margin,
    };
  };

  const totals = calculateTotals();

  const handleSubmit = async () => {
    if (saleItems.length === 0) {
      setErrorModal({ isOpen: true, message: "Please add at least one card to the sale" });
      return;
    }

    // Validate all items have prices (unless marked as free)
    for (const item of saleItems) {
      if (!item.isFree && (!item.pricePence || item.pricePence <= 0)) {
        setErrorModal({ isOpen: true, message: "Please enter a price for all cards or mark them as free" });
        return;
      }
      if (item.qty <= 0) {
        setErrorModal({ isOpen: true, message: "Please enter a valid quantity for all cards" });
        return;
      }
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
      const res = await fetch("/api/admin/sales/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lots: saleItems.map((item) => {
            // Determine purchase allocations
            const purchases = item.lot?.purchases || [];
            let purchaseAllocations: Array<{ purchaseId: string; qty: number }> = [];
            
            if (purchases.length === 1) {
              // Single purchase - allocate all to that purchase
              purchaseAllocations = [{ purchaseId: purchases[0].id, qty: item.qty }];
            } else if (purchases.length > 1) {
              if (item.manualAllocation && item.purchaseAllocations && item.purchaseAllocations.length > 0) {
                // Manual allocation
                purchaseAllocations = item.purchaseAllocations;
              } else {
                // Auto-allocation
                purchaseAllocations = autoAllocatePurchases(item);
              }
            }
            
            return {
              lotId: item.lotId,
              qty: item.qty,
              pricePence: item.pricePence,
              purchaseAllocations: purchaseAllocations.length > 0 ? purchaseAllocations : null,
            };
          }),
          buyerHandle: buyerHandle.trim(),
          orderGroup: orderGroup.trim() || null,
          feesPence: fees ? Math.round(parseFloat(fees) * 100) : null,
          shippingPence: shipping ? Math.round(parseFloat(shipping) * 100) : null,
          discountPence: dealDiscount && dealDiscount.amount > 0 ? Math.round(dealDiscount.amount) : null,
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

  // Filter lots based on search query
  const filteredLots = listedLots.filter((lot) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      lot.card?.name?.toLowerCase().includes(query) ||
      lot.card?.number?.toLowerCase().includes(query) ||
      lot.card?.set?.name?.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Record Sale"
        maxWidth="6xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || saleItems.length === 0}>
              {submitting ? "Creating Sale..." : "Record Sale"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Search and Add Cards Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Add Cards to Sale</h3>
            <div className="mb-3">
              <Input
                type="text"
                placeholder="Search by card name, number, or set..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            {loadingLots ? (
              <div className="text-sm text-gray-500 py-4">Loading listed cards...</div>
            ) : filteredLots.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">No listed cards available</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredLots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {lot.card ? `#${lot.card.number} ${lot.card.name}` : "Unknown card"}
                      </div>
                      <div className="text-xs text-gray-600">
                        {lot.card?.set?.name} • {lot.condition} • Available: {lot.available_qty}
                        {lot.list_price_pence && ` • List: £${penceToPounds(lot.list_price_pence)}`}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addCardToSale(lot)}
                      disabled={saleItems.some((item) => item.lotId === lot.id)}
                    >
                      {saleItems.some((item) => item.lotId === lot.id) ? "Added" : "Add"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sale Items */}
          {saleItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-3">Cards in Sale</h3>
              <div className="space-y-3">
                {saleItems.map((item, index) => {
                  const purchaseDisplay = getPurchaseDisplay(item);
                  return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {item.lot?.card ? `#${item.lot.card.number} ${item.lot.card.name}` : "Unknown card"}
                      </div>
                      <div className="text-xs text-gray-600">
                        {item.lot?.card?.set?.name} • {item.lot?.condition}
                      </div>
                      {/* Purchase information */}
                      {purchaseDisplay.type === "single" && (
                        <div className="text-xs text-gray-500 mt-1">
                          From: {purchaseDisplay.purchase.source_name}
                        </div>
                      )}
                      {purchaseDisplay.type === "all" && (
                        <div className="text-xs text-gray-500 mt-1">
                          From: {purchaseDisplay.purchases.map(p => p.source_name).join(", ")}
                        </div>
                      )}
                      {purchaseDisplay.type === "allocation" && (
                        <div className="mt-2 space-y-2">
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={purchaseDisplay.isManual}
                              onChange={(e) => updateSaleItem(index, "manualAllocation", e.target.checked)}
                              className="w-3 h-3"
                            />
                            <span>Manually allocate across purchases</span>
                          </label>
                          {purchaseDisplay.isManual ? (
                            <div className="space-y-1.5 pl-5">
                              {purchaseDisplay.purchases.map((purchase) => {
                                const allocation = purchaseDisplay.allocations.find(a => a.purchaseId === purchase.id);
                                const qty = allocation?.qty || 0;
                                const maxQty = Math.min(purchase.quantity, item.qty);
                                return (
                                  <div key={purchase.id} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600 w-32 truncate">{purchase.source_name}:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxQty}
                                      value={qty}
                                      onChange={(e) => {
                                        const newQty = parseInt(e.target.value, 10) || 0;
                                        updateSaleItem(index, "purchaseAllocation", {
                                          purchaseId: purchase.id,
                                          qty: Math.min(newQty, maxQty),
                                        });
                                      }}
                                      className="w-16 text-xs px-2 py-1 border border-gray-300 rounded"
                                    />
                                    <span className="text-xs text-gray-500">/ {purchase.quantity} available</span>
                                  </div>
                                );
                              })}
                              <div className="text-xs text-gray-500 mt-1">
                                Total: {purchaseDisplay.allocations.reduce((sum, a) => sum + a.qty, 0)} / {item.qty}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 pl-5">
                              Auto-allocated: {purchaseDisplay.allocations.map(a => {
                                const purchase = purchaseDisplay.purchases.find(p => p.id === a.purchaseId);
                                return `${purchase?.source_name} (${a.qty})`;
                              }).join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div>
                        <label className="text-xs text-gray-600">Qty</label>
                        <Input
                          type="number"
                          min="1"
                          max={item.lot?.available_qty || 1}
                          value={item.qty.toString()}
                          onChange={(e) => updateSaleItem(index, "qty", e.target.value)}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Price (£)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.pricePence ? penceToPounds(item.pricePence) : ""}
                          onChange={(e) => updateSaleItem(index, "pricePence", e.target.value)}
                          className="w-24"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Subtotal</label>
                        <div className="w-24 h-10 px-3 py-2 text-sm font-medium bg-gray-50 border border-gray-200 rounded-md flex items-center justify-end text-gray-900">
                          £{((item.pricePence || 0) * item.qty / 100).toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCardFromSale(index)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {/* Promotional Deal */}
          {promotionalDeals.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apply Promotional Deal (optional)
              </label>
              <select
                value={selectedDealId || ""}
                onChange={(e) => handleDealChange(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">No deal</option>
                {promotionalDeals
                  .filter((deal) => {
                    const totalCardCount = saleItems.reduce((sum, item) => sum + item.qty, 0);
                    return (
                      deal.is_active &&
                      totalCardCount >= deal.min_card_count &&
                      (!deal.max_card_count || totalCardCount <= deal.max_card_count)
                    );
                  })
                  .map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.name}
                    </option>
                  ))}
              </select>
              {selectedDealId && dealDiscount && (
                <div className="mt-2 text-sm">
                  {dealDiscount.type === "free_shipping" ? (
                    <span className="text-green-600 font-medium">Free shipping applied</span>
                  ) : (
                    <span className="text-green-600 font-medium">
                      Discount: £{penceToPounds(dealDiscount.amount)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buyer and Order Info */}
          <div className="grid grid-cols-2 gap-4">
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

            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Order Number <span className="text-gray-500">(optional)</span>
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
                placeholder="Enter or select order number"
                className="w-full"
              />
            </div>
          </div>

          {/* Fees and Shipping */}
          <div className="grid grid-cols-2 gap-4">
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
              <div className="text-sm text-gray-400 italic">No consumables added (auto-applied based on card count)</div>
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
          {saleItems.length > 0 && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <h3 className="font-semibold text-sm">Sale Summary</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">£{totals.revenue.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-£{totals.discount.toFixed(2)}</span>
                  </div>
                )}
                {selectedDealId && dealDiscount?.type === "free_shipping" && totals.shippingCost === 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Shipping:</span>
                    <span className="font-medium">Free</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-gray-300 pt-2">
                  <span>Total Revenue:</span>
                  <span>£{totals.revenueAfterDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Costs:</span>
                  <span className="font-medium text-red-600">-£{totals.totalCosts.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 pl-4 space-y-1">
                  <div className="flex justify-between">
                    <span>Fees:</span>
                    <span>£{totals.feesCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>£{totals.shippingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consumables:</span>
                    <span>£{totals.consumablesCost.toFixed(2)}</span>
                  </div>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between">
                  <span className="font-semibold">Net Profit:</span>
                  <span className={`font-bold ${totals.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    £{totals.netProfit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Margin:</span>
                  <span className={`font-medium ${totals.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totals.margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        message={errorModal.message}
      />
    </>
  );
}

