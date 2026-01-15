import { useState, useMemo } from "react";
import type { PurchaseLot as Lot } from "@/components/acquisitions/types";

export function useLotSelection(lots: Lot[]) {
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());

  const toggleLotSelection = (lotId: string) => {
    setSelectedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedLots(new Set());
  };

  const canMergeSelected = useMemo(() => {
    if (selectedLots.size < 2) return false;
    const selectedLotsArray = lots.filter((lot) => selectedLots.has(lot.id));
    if (selectedLotsArray.length < 2) return false;

    // All must have same card_id, condition, and variation
    const first = selectedLotsArray[0];
    const allSameCard = selectedLotsArray.every(
      (lot) =>
        lot.card_id === first.card_id &&
        lot.condition === first.condition &&
        (lot.variation || "standard") === (first.variation || "standard")
    );

    // All must be active (not sold or archived)
    const allActive = selectedLotsArray.every(
      (lot) => lot.status !== "sold" && lot.status !== "archived"
    );

    // None can have sold items
    const noneHaveSales = selectedLotsArray.every((lot) => lot.sold_qty === 0);

    return allSameCard && allActive && noneHaveSales;
  }, [selectedLots, lots]);

  return {
    selectedLots,
    toggleLotSelection,
    clearSelection,
    canMergeSelected,
  };
}
