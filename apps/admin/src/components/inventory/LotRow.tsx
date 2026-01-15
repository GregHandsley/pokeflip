import { penceToPounds } from "@pokeflip/shared";
// import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { variationLabel } from "./variations";
import { getDisplayStatus } from "./CardLotsView.types";
import SoldItemsDropdown from "./SoldItemsDropdown";
import type { Lot, SalesItem } from "./CardLotsView.types";

interface Props {
  lot: Lot;
  isSelected: boolean;
  isDeleting: boolean;
  isSoldItemsExpanded: boolean;
  isLoadingSalesItems: boolean;
  salesItems: SalesItem[];
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
  onSplit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleSoldItems: () => void;
}

export default function LotRow({
  lot,
  isSelected,
  isDeleting,
  isSoldItemsExpanded,
  isLoadingSalesItems,
  salesItems,
  onSelect,
  onClick,
  onSplit,
  onDelete,
  onToggleSoldItems,
}: Props) {
  const missingPhotos = !lot.use_api_image && (!lot.photo_count || lot.photo_count < 2);
  const displayStatus = getDisplayStatus(lot);

  return (
    <div
      className={`pl-3 pr-2 py-2 bg-white rounded border ${
        isSelected ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-gray-300"
      } transition-colors cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(e as unknown as React.MouseEvent);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium text-sm">{lot.available_qty}</span>
            <span className="text-gray-500 text-xs">/ {lot.quantity}</span>
            {lot.sold_qty > 0 && (
              <span className="text-gray-400 text-xs">({lot.sold_qty} sold)</span>
            )}
            {lot.variation && lot.variation !== "standard" && (
              <span className="px-2 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">
                {variationLabel(lot.variation)}
              </span>
            )}
            {lot.sku && <span className="text-[10px] text-gray-400 font-mono">{lot.sku}</span>}
            {lot.for_sale && lot.list_price_pence != null && (
              <span className="text-green-600 font-medium text-xs">
                £{penceToPounds(lot.list_price_pence)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {missingPhotos ? (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"
                title="Add front and back photos"
              >
                Missing photos
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${displayStatus.color}`}
                title={`Status: ${displayStatus.label}`}
              >
                {displayStatus.label}
              </span>
            )}
            {lot.bundle_reserved_qty && lot.bundle_reserved_qty > 0 && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"
                title={`${lot.bundle_reserved_qty} reserved in bundle(s)`}
              >
                In Bundle ({lot.bundle_reserved_qty})
              </span>
            )}
            {!lot.for_sale && !lot.bundle_reserved_qty && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700"
                title="Not for sale - will not appear in inbox"
              >
                Not For Sale
              </span>
            )}
            {lot.use_api_image ? (
              <span className="text-blue-600 text-xs" title="Using API image">
                🖼️ API
              </span>
            ) : lot.photo_count > 0 ? (
              <span
                className="text-gray-500 text-xs"
                title={`${lot.photo_count} photo${lot.photo_count !== 1 ? "s" : ""}`}
              >
                📷 {lot.photo_count}
              </span>
            ) : null}
            {lot.status !== "sold" && lot.status !== "archived" && lot.available_qty > 1 && (
              <button
                onClick={onSplit}
                className="ml-1 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                title="Split quantity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="ml-1 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete this lot"
            >
              {isDeleting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-1.5 ml-6 space-y-1">
        {lot.purchases && lot.purchases.length > 0 ? (
          <div className="text-xs text-gray-600">
            <span className="font-medium">From purchase{lot.purchases.length > 1 ? "s" : ""}:</span>{" "}
            {lot.purchases.map((p, idx) => (
              <span key={p.id}>
                {idx > 0 && ", "}
                <a
                  href={`/admin/acquisitions/${p.id}/lots`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.source_name}
                </a>
                {p.quantity > 1 && <span className="text-gray-500"> ({p.quantity})</span>}
                {p.status === "closed" && <span className="ml-1 text-gray-400">(closed)</span>}
              </span>
            ))}
          </div>
        ) : lot.purchase ? (
          <div className="text-xs text-gray-600">
            <span className="font-medium">From purchase:</span>{" "}
            <a
              href={`/admin/acquisitions/${lot.purchase.id}/lots`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {lot.purchase.source_name}
            </a>
            {lot.purchase.status === "closed" && (
              <span className="ml-1 text-gray-400">(closed)</span>
            )}
          </div>
        ) : null}
        {lot.note && <div className="text-gray-500 italic text-xs">{lot.note}</div>}
        {lot.sold_qty > 0 && lot.status !== "sold" && (
          <SoldItemsDropdown
            lotId={lot.id}
            soldQty={lot.sold_qty}
            isExpanded={isSoldItemsExpanded}
            isLoading={isLoadingSalesItems}
            salesItems={salesItems}
            onToggle={onToggleSoldItems}
          />
        )}
      </div>
    </div>
  );
}
