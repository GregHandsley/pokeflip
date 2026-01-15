import type { PurchaseLot as Lot } from "@/components/acquisitions/types";
import { LotRow } from "./LotRow";
import { groupLotsBySet } from "../utils/lotUtils";

type LotsBySetListProps = {
  lots: Lot[];
  selectedLots: Set<string>;
  removingDraftId: string | null;
  onToggleSelection: (lotId: string) => void;
  onLotClick: (lot: Lot) => void;
  onRemoveDraft: (lotId: string) => void;
  onSplitClick: (lot: Lot) => void;
};

export function LotsBySetList({
  lots,
  selectedLots,
  removingDraftId,
  onToggleSelection,
  onLotClick,
  onRemoveDraft,
  onSplitClick,
}: LotsBySetListProps) {
  const lotsBySet = groupLotsBySet(lots);

  if (Object.keys(lotsBySet).length === 0) {
    return (
      <div className="text-sm text-gray-600 py-8 text-center">
        No cards in this purchase yet. Add cards and commit to create inventory entries.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(lotsBySet)
        .sort(([setIdA], [setIdB]) => {
          const setA = lotsBySet[setIdA]?.[0]?.card?.set?.name || "";
          const setB = lotsBySet[setIdB]?.[0]?.card?.set?.name || "";
          return setA.localeCompare(setB);
        })
        .map(([setId, setLots]) => {
          const set = setLots[0]?.card?.set;
          return (
            <div key={setId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="font-medium">{set?.name || "Unknown Set"}</div>
                <div className="text-xs text-gray-600">
                  {setLots.length} card{setLots.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {setLots.map((lot) => {
                  const isDraft = lot.is_draft || lot.id.startsWith("draft-");
                  const isSelected = selectedLots.has(lot.id);
                  const canSplit =
                    !isDraft &&
                    lot.status !== "sold" &&
                    lot.status !== "archived" &&
                    lot.available_qty > 1;
                  return (
                    <LotRow
                      key={lot.id}
                      lot={lot}
                      isSelected={isSelected}
                      isDraft={isDraft}
                      canSplit={canSplit}
                      removingDraftId={removingDraftId}
                      onToggleSelection={onToggleSelection}
                      onLotClick={onLotClick}
                      onRemoveDraft={onRemoveDraft}
                      onSplitClick={onSplitClick}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
