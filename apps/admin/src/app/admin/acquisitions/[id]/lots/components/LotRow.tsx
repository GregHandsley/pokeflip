import Image from "next/image";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { variationLabel } from "@/components/inventory/variations";
import type { PurchaseLot as Lot } from "@/components/acquisitions/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

type LotRowProps = {
  lot: Lot;
  isSelected: boolean;
  isDraft: boolean;
  canSplit: boolean;
  removingDraftId: string | null;
  onToggleSelection: (lotId: string) => void;
  onLotClick: (lot: Lot) => void;
  onRemoveDraft: (lotId: string) => void;
  onSplitClick: (lot: Lot) => void;
};

export function LotRow({
  lot,
  isSelected,
  isDraft,
  canSplit,
  removingDraftId,
  onToggleSelection,
  onLotClick,
  onRemoveDraft,
  onSplitClick,
}: LotRowProps) {
  return (
    <div
      className={`px-4 py-3 transition-colors ${
        isDraft
          ? "bg-yellow-50 border-l-4 border-l-yellow-400"
          : isSelected
            ? "bg-blue-50 border-l-4 border-l-blue-500"
            : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-4">
        {!isDraft && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection(lot.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
        )}
        {isDraft && (
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-yellow-600 text-xs">⚠</span>
          </div>
        )}
        {lot.card?.image_url && (
          <div
            className={`relative h-16 ${isDraft ? "" : "cursor-pointer"}`}
            style={{ width: "auto", minWidth: "64px" }}
            onClick={() => {
              if (!isDraft) {
                onLotClick(lot);
              }
            }}
          >
            <Image
              src={`${lot.card.image_url}/low.webp`}
              alt={`${lot.card.name} card`}
              width={64}
              height={64}
              className="h-16 w-auto rounded border border-gray-200 object-contain"
              unoptimized
            />
          </div>
        )}
        <div
          className={`flex-1 min-w-0 ${isDraft ? "" : "cursor-pointer"}`}
          onClick={() => {
            if (!isDraft) {
              onLotClick(lot);
            }
          }}
        >
          <div className="font-medium text-sm">
            <span className="text-gray-500 font-normal">#{lot.card?.number}</span> {lot.card?.name}
            {isDraft && (
              <span className="ml-2 text-xs text-yellow-700 font-normal">
                (Not in inventory yet)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {lot.card?.rarity && <span className="text-xs text-gray-500">{lot.card.rarity}</span>}
            <span className="text-xs text-gray-600">
              {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition}
            </span>
            {lot.variation && lot.variation !== "standard" && (
              <span className="text-xs text-gray-600">• {variationLabel(lot.variation)}</span>
            )}
          </div>
        </div>
        <div className="text-right text-sm space-y-1">
          <div>
            <span className="text-gray-600">Qty:</span>{" "}
            <span className="font-medium">
              {lot.available_qty} / {lot.quantity}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            {isDraft ? (
              <>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                  Uncommitted
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Are you sure you want to remove this uncommitted card?")) {
                      onRemoveDraft(lot.id);
                    }
                  }}
                  disabled={removingDraftId === lot.id}
                  className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Remove uncommitted card"
                >
                  {removingDraftId === lot.id ? (
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
              </>
            ) : (
              <>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    STATUS_COLORS[lot.status] || STATUS_COLORS.draft
                  }`}
                >
                  {lot.status === "ready"
                    ? "Ready to list"
                    : lot.status.charAt(0).toUpperCase() + lot.status.slice(1)}
                </span>
                {!lot.for_sale && (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700"
                    title="Not for sale - will not appear in inbox"
                  >
                    Not For Sale
                  </span>
                )}
              </>
            )}
            {canSplit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSplitClick(lot);
                }}
                className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
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
          </div>
        </div>
      </div>
    </div>
  );
}
