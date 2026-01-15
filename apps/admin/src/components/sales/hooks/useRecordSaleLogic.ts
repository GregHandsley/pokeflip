import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import { autoAllocatePurchases, calculateDealDiscount } from "../utils/saleCalculations";
import type {
  ListedLot,
  SaleItem,
  Consumable,
  ConsumableSelection,
  PromotionalDeal,
  PurchaseAllocation,
} from "../types";

export function useRecordSaleLogic(
  saleItems: SaleItem[],
  setSaleItems: (items: SaleItem[] | ((prev: SaleItem[]) => SaleItem[])) => void,
  consumables: Consumable[],
  selectedConsumables: ConsumableSelection[],
  setSelectedConsumables: (items: ConsumableSelection[]) => void,
  promotionalDeals: PromotionalDeal[],
  selectedDealId: string | null,
  setDealDiscount: (discount: { type: string; amount: number } | null) => void
) {
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });

  const addCardToSale = useCallback(
    (lot: ListedLot) => {
      if (saleItems.some((item) => item.lotId === lot.id)) {
        setErrorModal({ isOpen: true, message: "This card is already in the sale" });
        return;
      }

      const newItem: SaleItem = {
        lotId: lot.id,
        lot,
        qty: 1,
        pricePence: lot.list_price_pence,
        isFree: false,
        manualAllocation: false,
        purchaseAllocations: [],
      };

      const purchases = lot.purchases || [];
      if (purchases.length > 1) {
        newItem.purchaseAllocations = autoAllocatePurchases(newItem);
      }

      setSaleItems([...saleItems, newItem]);
    },
    [saleItems, setSaleItems]
  );

  const removeCardFromSale = useCallback(
    (index: number) => {
      setSaleItems(saleItems.filter((_, i) => i !== index));
    },
    [saleItems, setSaleItems]
  );

  const updateSaleItem = useCallback(
    (
      index: number,
      field:
        | "qty"
        | "pricePence"
        | "isFree"
        | "selectedPurchaseId"
        | "manualAllocation"
        | "purchaseAllocation",
      value: string | number | boolean | PurchaseAllocation | null
    ) => {
      const updated = [...saleItems];
      if (field === "qty") {
        const qty = parseInt(String(value ?? "1"), 10) || 1;
        const lot = updated[index].lot;
        if (lot && qty > lot.available_qty) {
          setErrorModal({ isOpen: true, message: `Only ${lot.available_qty} available` });
          return;
        }
        updated[index].qty = Math.max(1, Math.min(qty, lot?.available_qty || 1));
        if (!updated[index].manualAllocation) {
          const autoAllocs = autoAllocatePurchases(updated[index]);
          updated[index].purchaseAllocations = autoAllocs;
        } else if (updated[index].purchaseAllocations) {
          const currentTotal = updated[index].purchaseAllocations.reduce(
            (sum, a) => sum + a.qty,
            0
          );
          if (
            currentTotal !== updated[index].qty &&
            updated[index].purchaseAllocations.length > 0
          ) {
            const diff = updated[index].qty - currentTotal;
            const lastAlloc =
              updated[index].purchaseAllocations[updated[index].purchaseAllocations.length - 1];
            lastAlloc.qty = Math.max(0, lastAlloc.qty + diff);
          }
        }
      } else if (field === "pricePence") {
        const pricePounds = parseFloat(String(value ?? "0")) || 0;
        updated[index].pricePence = pricePounds > 0 ? Math.round(pricePounds * 100) : null;
        if (pricePounds > 0) {
          updated[index].isFree = false;
        }
      } else if (field === "isFree") {
        updated[index].isFree = value === true;
        if (value === true) {
          updated[index].pricePence = 0;
        }
      } else if (field === "selectedPurchaseId") {
        updated[index].selectedPurchaseId = typeof value === "string" ? value : null;
      } else if (field === "manualAllocation") {
        updated[index].manualAllocation = value === true;
        if (value === true && !updated[index].purchaseAllocations) {
          const autoAllocs = autoAllocatePurchases(updated[index]);
          updated[index].purchaseAllocations = autoAllocs;
        }
      } else if (field === "purchaseAllocation") {
        if (!value || typeof value !== "object" || !("purchaseId" in value) || !("qty" in value)) {
          return;
        }
        const allocation = value as PurchaseAllocation;
        if (!updated[index].purchaseAllocations) {
          updated[index].purchaseAllocations = [];
        }
        const allocs = updated[index].purchaseAllocations!;
        const existingIndex = allocs.findIndex((a) => a.purchaseId === allocation.purchaseId);
        if (allocation.qty > 0) {
          if (existingIndex >= 0) {
            allocs[existingIndex].qty = allocation.qty;
          } else {
            allocs.push({ purchaseId: allocation.purchaseId, qty: allocation.qty });
          }
        } else {
          if (existingIndex >= 0) {
            allocs.splice(existingIndex, 1);
          }
        }
        const total = allocs.reduce((sum, a) => sum + a.qty, 0);
        if (total !== updated[index].qty) {
          if (allocs.length > 0) {
            const diff = updated[index].qty - total;
            allocs[allocs.length - 1].qty = Math.max(0, allocs[allocs.length - 1].qty + diff);
          }
        }
      }
      setSaleItems(updated);
      if (selectedDealId) {
        const deal = promotionalDeals.find((d) => d.id === selectedDealId);
        if (deal) {
          const discount = calculateDealDiscount(updated, deal);
          setDealDiscount(discount);
        }
      }
    },
    [saleItems, setSaleItems, selectedDealId, promotionalDeals, setDealDiscount]
  );

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
          type PackagingRuleConsumable = {
            consumable_id: string;
            consumable_name: string;
            qty: number;
          };
          const selections: ConsumableSelection[] = (
            json.consumables as PackagingRuleConsumable[]
          ).map((c) => {
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
        logger.error("Failed to apply packaging rule", e);
      }
    },
    [consumables, setSelectedConsumables]
  );

  useEffect(() => {
    if (saleItems.length > 0 && consumables.length > 0) {
      const totalCardCount = saleItems.reduce((sum, item) => sum + item.qty, 0);
      if (totalCardCount > 0) {
        applyPackagingRule(totalCardCount);
      }
    }
  }, [saleItems, consumables.length, applyPackagingRule]);

  const handleAddConsumable = useCallback(() => {
    setSelectedConsumables([
      ...selectedConsumables,
      {
        consumable_id: "",
        consumable_name: "",
        qty: 1,
        unit_cost_pence: 0,
      },
    ]);
  }, [selectedConsumables, setSelectedConsumables]);

  const handleRemoveConsumable = useCallback(
    (index: number) => {
      setSelectedConsumables(selectedConsumables.filter((_, i) => i !== index));
    },
    [selectedConsumables, setSelectedConsumables]
  );

  const handleUpdateConsumable = useCallback(
    (index: number, field: keyof ConsumableSelection, value: string | number) => {
      const updated = [...selectedConsumables];
      if (field === "consumable_id") {
        const consumableId = String(value);
        const consumable = consumables.find((c) => c.consumable_id === consumableId);
        updated[index] = {
          ...updated[index],
          consumable_id: consumableId,
          consumable_name: consumable?.name || "",
          unit_cost_pence: consumable?.avg_cost_pence_per_unit || 0,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      setSelectedConsumables(updated);
    },
    [selectedConsumables, consumables, setSelectedConsumables]
  );

  const handleDealChange = useCallback(
    (dealId: string | null, setSelectedDealId: (id: string | null) => void) => {
      setSelectedDealId(dealId);
      if (dealId) {
        const deal = promotionalDeals.find((d) => d.id === dealId);
        if (deal) {
          const discount = calculateDealDiscount(saleItems, deal);
          setDealDiscount(discount);
        }
      } else {
        setDealDiscount(null);
      }
    },
    [saleItems, promotionalDeals, setDealDiscount]
  );

  // Note: This effect is handled by the parent component when selectedDealId changes
  // We don't need to re-trigger here as handleDealChange is called directly

  return {
    errorModal,
    setErrorModal,
    addCardToSale,
    removeCardFromSale,
    updateSaleItem,
    handleAddConsumable,
    handleRemoveConsumable,
    handleUpdateConsumable,
    handleDealChange,
  };
}
