import type { PurchaseLot as Lot } from "@/components/acquisitions/types";

export function groupLotsBySet(lots: Lot[]): Record<string, Lot[]> {
  const lotsBySet = lots.reduce(
    (acc, lot) => {
      const setId = lot.card?.set?.id || "unknown";
      if (!acc[setId]) {
        acc[setId] = [];
      }
      acc[setId].push(lot);
      return acc;
    },
    {} as Record<string, Lot[]>
  );

  // Sort cards within each set by card number
  Object.keys(lotsBySet).forEach((setId) => {
    lotsBySet[setId].sort((a, b) => {
      const numA = parseInt(a.card?.number || "0", 10) || 0;
      const numB = parseInt(b.card?.number || "0", 10) || 0;
      if (numA !== numB) {
        return numA - numB;
      }
      // If numbers are equal, sort by card name
      return (a.card?.name || "").localeCompare(b.card?.name || "");
    });
  });

  return lotsBySet;
}
