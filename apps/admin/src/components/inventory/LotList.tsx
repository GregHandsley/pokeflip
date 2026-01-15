import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import LotRow from "./LotRow";
import type { Lot, SalesItem } from "./CardLotsView.types";

interface Props {
  lots: Lot[];
  selectedLots: Set<string>;
  deletingLotId: string | null;
  activeLotSoldItemsExpanded: Set<string>;
  loadingSalesItems: Set<string>;
  salesItemsByLot: Map<string, SalesItem[]>;
  onSelect: (lotId: string, e: React.MouseEvent) => void;
  onLotClick: (lot: Lot) => void;
  onSplit: (lot: Lot, e: React.MouseEvent) => void;
  onDelete: (lot: Lot, e: React.MouseEvent) => void;
  onToggleSoldItems: (lotId: string) => void;
}

export default function LotList({
  lots,
  selectedLots,
  deletingLotId,
  activeLotSoldItemsExpanded,
  loadingSalesItems,
  salesItemsByLot,
  onSelect,
  onLotClick,
  onSplit,
  onDelete,
  onToggleSoldItems,
}: Props) {
  const lotsByCondition = lots.reduce(
    (acc, lot) => {
      if (!acc[lot.condition]) {
        acc[lot.condition] = [];
      }
      acc[lot.condition].push(lot);
      return acc;
    },
    {} as Record<string, Lot[]>
  );

  return (
    <div className="space-y-3">
      {Object.entries(lotsByCondition)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([condition, conditionLots]) => (
          <div key={condition} className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              {CONDITION_LABELS[condition as keyof typeof CONDITION_LABELS] || condition}
            </div>
            <div className="space-y-1.5">
              {conditionLots.map((lot) => (
                <LotRow
                  key={lot.id}
                  lot={lot}
                  isSelected={selectedLots.has(lot.id)}
                  isDeleting={deletingLotId === lot.id}
                  isSoldItemsExpanded={activeLotSoldItemsExpanded.has(lot.id)}
                  isLoadingSalesItems={loadingSalesItems.has(lot.id)}
                  salesItems={salesItemsByLot.get(lot.id) || []}
                  onSelect={(e) => onSelect(lot.id, e)}
                  onClick={() => onLotClick(lot)}
                  onSplit={(e) => onSplit(lot, e)}
                  onDelete={(e) => onDelete(lot, e)}
                  onToggleSoldItems={() => onToggleSoldItems(lot.id)}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
