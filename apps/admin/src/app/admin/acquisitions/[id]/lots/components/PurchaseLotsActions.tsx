type PurchaseLotsActionsProps = {
  draftCount: number;
  committing: boolean;
  selectedLotsCount: number;
  canMergeSelected: boolean;
  updatingForSale: boolean;
  onCommit: () => void;
  onMerge: () => void;
  onBulkUpdateForSale: (forSale: boolean) => void;
  onClearSelection: () => void;
};

export function PurchaseLotsActions({
  draftCount,
  committing,
  selectedLotsCount,
  canMergeSelected,
  updatingForSale,
  onCommit,
  onMerge,
  onBulkUpdateForSale,
  onClearSelection,
}: PurchaseLotsActionsProps) {
  return (
    <>
      {/* Primary Actions */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        {draftCount > 0 && (
          <button
            onClick={onCommit}
            disabled={committing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {committing ? "Committing..." : `Commit to Inventory (${draftCount})`}
          </button>
        )}
        {selectedLotsCount >= 2 && canMergeSelected && (
          <button
            onClick={onMerge}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Merge Selected ({selectedLotsCount})
          </button>
        )}
      </div>

      {/* Bulk Actions (when cards are selected) */}
      {selectedLotsCount > 0 && (
        <div className="flex items-center gap-2 mb-6">
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
          <button
            onClick={onClearSelection}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded border border-gray-200 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </>
  );
}
