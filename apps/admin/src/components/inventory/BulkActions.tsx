import type { Lot } from "./CardLotsView.types";

interface Props {
  lots: Lot[];
  selectedLots: Set<string>;
  canMerge: boolean;
  updatingForSale: boolean;
  deletingLotId: string | null;
  onToggleSelectAll: () => void;
  onBulkUpdateForSale: (forSale: boolean) => void;
  onMerge: () => void;
  onBulkDelete: () => void;
}

export default function BulkActions({
  lots,
  selectedLots,
  canMerge,
  updatingForSale,
  deletingLotId,
  onBulkUpdateForSale,
  onMerge,
  onBulkDelete,
}: Props) {
  // Filter out sold lots from selectedLots for bulk actions
  const activeSelectedLots = Array.from(selectedLots).filter((lotId) => {
    const lot = lots.find((l) => l.id === lotId);
    return lot && lot.status !== "sold" && lot.status !== "archived";
  });

  return (
    <div className="flex items-center justify-between mb-3">
      {activeSelectedLots.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBulkUpdateForSale(true)}
            disabled={updatingForSale}
            className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updatingForSale ? "Updating..." : "Mark For Sale"}
          </button>
          <button
            onClick={() => onBulkUpdateForSale(false)}
            disabled={updatingForSale}
            className="px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updatingForSale ? "Updating..." : "Mark Not For Sale"}
          </button>
          {canMerge && (
            <button
              onClick={onMerge}
              disabled={updatingForSale}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Merge
            </button>
          )}
          <button
            onClick={onBulkDelete}
            disabled={deletingLotId === "bulk" || updatingForSale}
            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deletingLotId === "bulk"
              ? "Deleting..."
              : `Delete ${activeSelectedLots.length} card${activeSelectedLots.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
