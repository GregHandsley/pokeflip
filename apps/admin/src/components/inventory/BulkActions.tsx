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
  onToggleSelectAll,
  onBulkUpdateForSale,
  onMerge,
  onBulkDelete,
}: Props) {
  const allSelected = selectedLots.size === lots.length && lots.length > 0;
  const someSelected = selectedLots.size > 0 && selectedLots.size < lots.length;

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSelectAll}
          className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900"
          title={allSelected ? "Deselect all" : "Select all"}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected;
            }}
            onChange={onToggleSelectAll}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span>
            Cards ({lots.length})
            {selectedLots.size > 0 && (
              <span className="text-blue-600 ml-1">• {selectedLots.size} selected</span>
            )}
          </span>
        </button>
      </div>
      {selectedLots.size > 0 && (
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
              : `Delete ${selectedLots.size} card${selectedLots.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
