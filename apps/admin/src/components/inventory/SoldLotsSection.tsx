import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { variationLabel } from "./variations";
import { STATUS_COLORS } from "./CardLotsView.types";
import type { Lot } from "./CardLotsView.types";

interface Props {
  lots: Lot[];
  isExpanded: boolean;
  selectedLots: Set<string>;
  deletingLotId: string | null;
  onToggleExpanded: () => void;
  onSelect: (lotId: string, e: React.SyntheticEvent) => void;
  onDelete: (lot: Lot, e: React.MouseEvent) => void;
}

export default function SoldLotsSection({
  lots,
  isExpanded,
  selectedLots,
  deletingLotId,
  onToggleExpanded,
  onSelect,
  onDelete,
}: Props) {
  if (lots.length === 0) return null;

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
    <div className="mt-4 pt-4 border-t border-gray-300">
      <button
        onClick={onToggleExpanded}
        className="w-full flex items-center justify-between text-left text-sm text-gray-600 hover:text-gray-900"
      >
        <span className="font-medium">Sold Cards ({lots.length})</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-3">
          {Object.entries(lotsByCondition)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([condition, conditionLots]) => (
              <div key={`sold-${condition}`} className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {CONDITION_LABELS[condition as keyof typeof CONDITION_LABELS] || condition} (Sold)
                </div>
                <div className="space-y-1.5">
                  {conditionLots.map((lot) => {
                    const isSelected = selectedLots.has(lot.id);
                    const isDeleting = deletingLotId === lot.id;
                    return (
                      <div
                        key={lot.id}
                        className="pl-3 pr-2 py-2 bg-gray-50 rounded border border-gray-200 opacity-75 cursor-pointer hover:bg-gray-100"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/admin/lots/${lot.id}/sales-order`);
                            const json = await res.json();
                            if (json.ok && json.salesOrderId) {
                              window.location.href = `/admin/sales?orderId=${json.salesOrderId}`;
                            }
                          } catch {
                            // Error handling is done in the component
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              onSelect(lot.id, e);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-medium text-sm text-gray-600">
                                {lot.available_qty}
                              </span>
                              <span className="text-gray-400 text-xs">/ {lot.quantity}</span>
                              {lot.sold_qty > 0 && (
                                <span className="text-gray-400 text-xs">({lot.sold_qty} sold)</span>
                              )}
                              {lot.variation && lot.variation !== "standard" && (
                                <span className="px-2 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">
                                  {variationLabel(lot.variation)}
                                </span>
                              )}
                              {lot.sku && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {lot.sku}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  STATUS_COLORS[lot.status] || STATUS_COLORS.draft
                                }`}
                              >
                                {lot.status}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(lot, e);
                                }}
                                disabled={isDeleting}
                                className="ml-1 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete this lot"
                              >
                                {isDeleting ? (
                                  <svg
                                    className="w-4 h-4 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
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
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
