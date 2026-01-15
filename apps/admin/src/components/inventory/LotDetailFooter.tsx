import type { Lot } from "./LotDetailModal.types";

interface Props {
  lot: Lot;
  canToggleForSale: boolean;
  updatingForSale: boolean;
  onToggleForSale: () => void;
  onClose: () => void;
}

export default function LotDetailFooter({
  lot,
  canToggleForSale,
  updatingForSale,
  onToggleForSale,
  onClose,
}: Props) {
  return (
    <div className="flex items-center justify-end gap-3 w-full">
      {canToggleForSale && (
        <>
          {!lot.for_sale ? (
            <button
              onClick={onToggleForSale}
              disabled={updatingForSale}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingForSale ? "Saving..." : "Mark For Sale"}
            </button>
          ) : (
            <button
              onClick={onToggleForSale}
              disabled={updatingForSale}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingForSale ? "Saving..." : "Mark Not For Sale"}
            </button>
          )}
        </>
      )}
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
      >
        Close
      </button>
    </div>
  );
}
