"use client";

import { useState, useEffect } from "react";
import { penceToPounds } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import LotDetailModal from "./LotDetailModal";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";

type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
};

type Lot = {
  id: string;
  condition: string;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  ebay_status: string;
  photo_count: number;
  purchase: Purchase | null;
};

interface Props {
  cardId: string;
  isExpanded: boolean;
  onLotsChanged?: () => void; // Callback to refresh parent data
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function CardLotsView({ cardId, isExpanded, onLotsChanged }: Props) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [soldLotsExpanded, setSoldLotsExpanded] = useState(false);

  const loadLots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/cards/${cardId}/lots`);
      const json = await res.json();
      if (json.ok) {
        setLots(json.lots || []);
      }
    } catch (e) {
      console.error("Failed to load lots:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      void loadLots();
    } else {
      // Reset state when collapsed
      setLots([]);
      setSelectedLots(new Set());
    }
  }, [isExpanded, cardId]);

  const handleDeleteLot = async (lotId: string) => {
    setDeletingLotId(lotId);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/delete`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete lot");
      }

      // Remove from local state
      setLots((prev) => prev.filter((l) => l.id !== lotId));
      setSelectedLots((prev) => {
        const next = new Set(prev);
        next.delete(lotId);
        return next;
      });

      // Notify parent to refresh totals
      onLotsChanged?.();
    } catch (e: any) {
      alert(e.message || "Failed to delete lot");
    } finally {
      setDeletingLotId(null);
      setShowSingleDeleteConfirm(false);
      setLotToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLots.size === 0) return;

    const lotIds = Array.from(selectedLots);
    setDeletingLotId("bulk");
    try {
      // Delete lots one by one (could be optimized with a bulk endpoint)
      await Promise.all(
        lotIds.map((lotId) =>
          fetch(`/api/admin/lots/${lotId}/delete`, { method: "DELETE" })
        )
      );

      // Remove from local state
      setLots((prev) => prev.filter((l) => !selectedLots.has(l.id)));
      setSelectedLots(new Set());

      // Notify parent to refresh totals
      onLotsChanged?.();
    } catch (e: any) {
      alert("Failed to delete some lots");
    } finally {
      setDeletingLotId(null);
      setShowBulkDeleteConfirm(false);
    }
  };

  const toggleLotSelection = (lotId: string) => {
    setSelectedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLots.size === lots.length) {
      setSelectedLots(new Set());
    } else {
      setSelectedLots(new Set(lots.map((l) => l.id)));
    }
  };

  if (!isExpanded) return null;

  if (loading) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">Loading lots...</div>
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-500">No lots found</div>
      </div>
    );
  }

  // Separate active and sold lots
  const activeLots = lots.filter((lot) => lot.status !== "sold" && lot.status !== "archived");
  const soldLots = lots.filter((lot) => lot.status === "sold");

  // Group active lots by condition
  const lotsByCondition = activeLots.reduce((acc, lot) => {
    if (!acc[lot.condition]) {
      acc[lot.condition] = [];
    }
    acc[lot.condition].push(lot);
    return acc;
  }, {} as Record<string, Lot[]>);

  // Group sold lots by condition (for collapsed section)
  const soldLotsByCondition = soldLots.reduce((acc, lot) => {
    if (!acc[lot.condition]) {
      acc[lot.condition] = [];
    }
    acc[lot.condition].push(lot);
    return acc;
  }, {} as Record<string, Lot[]>);

  const allSelected = selectedLots.size === lots.length && lots.length > 0;
  const someSelected = selectedLots.size > 0 && selectedLots.size < lots.length;

  return (
    <>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        {/* Header with bulk actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span>
                Lots ({lots.length})
                {selectedLots.size > 0 && (
                  <span className="text-blue-600 ml-1">
                    • {selectedLots.size} selected
                  </span>
                )}
              </span>
            </button>
          </div>
          {selectedLots.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={deletingLotId === "bulk"}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deletingLotId === "bulk" ? "Deleting..." : `Delete ${selectedLots.size} lot${selectedLots.size !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {/* Active lots grouped by condition */}
        <div className="space-y-3">
          {Object.entries(lotsByCondition)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([condition, conditionLots]) => (
              <div key={condition} className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {CONDITION_LABELS[condition as keyof typeof CONDITION_LABELS] || condition}
                </div>
                <div className="space-y-1.5">
                  {conditionLots.map((lot) => {
                    const isSelected = selectedLots.has(lot.id);
                    const isDeleting = deletingLotId === lot.id;
                    return (
                      <div
                        key={lot.id}
                        className={`pl-3 pr-2 py-2 bg-white rounded border ${
                          isSelected
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        } transition-colors cursor-pointer`}
                        onClick={() => setSelectedLot(lot)}
                      >
                        <div className="flex items-center gap-2">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleLotSelection(lot.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          {/* Lot info */}
                          <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-medium text-sm">
                                {lot.available_qty}
                              </span>
                              <span className="text-gray-500 text-xs">
                                / {lot.quantity}
                              </span>
                              {lot.sold_qty > 0 && (
                                <span className="text-gray-400 text-xs">
                                  ({lot.sold_qty} sold)
                                </span>
                              )}
                              {lot.for_sale && lot.list_price_pence != null && (
                                <span className="text-green-600 font-medium text-xs">
                                  £{penceToPounds(lot.list_price_pence)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  STATUS_COLORS[lot.status] || STATUS_COLORS.draft
                                }`}
                              >
                                {lot.status}
                              </span>
                              {lot.photo_count > 0 && (
                                <span className="text-gray-500 text-xs" title={`${lot.photo_count} photo${lot.photo_count !== 1 ? "s" : ""}`}>
                                  📷 {lot.photo_count}
                                </span>
                              )}
                              {lot.ebay_status !== "not_listed" && (
                                <span
                                  className="text-xs"
                                  title={`eBay: ${lot.ebay_status}`}
                                >
                                  {lot.ebay_status === "live" ? "🟢" : "⚪"}
                                </span>
                              )}
                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLotToDelete(lot);
                                  setShowSingleDeleteConfirm(true);
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
                        <div className="mt-1.5 ml-6 space-y-1">
                          {lot.purchase && (
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
                          )}
                          {lot.note && (
                            <div className="text-gray-500 italic text-xs">
                              {lot.note}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {/* Sold lots section (collapsed by default) */}
          {soldLots.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <button
                onClick={() => setSoldLotsExpanded(!soldLotsExpanded)}
                className="w-full flex items-center justify-between text-left text-sm text-gray-600 hover:text-gray-900"
              >
                <span className="font-medium">
                  Sold Lots ({soldLots.length})
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    soldLotsExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {soldLotsExpanded && (
                <div className="mt-2 space-y-3">
                {Object.entries(soldLotsByCondition)
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
                              className={`pl-3 pr-2 py-2 bg-gray-50 rounded border border-gray-200 opacity-75`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleLotSelection(lot.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="font-medium text-sm text-gray-600">
                                      {lot.available_qty}
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                      / {lot.quantity}
                                    </span>
                                    {lot.sold_qty > 0 && (
                                      <span className="text-gray-400 text-xs">
                                        ({lot.sold_qty} sold)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
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
                                        setLotToDelete(lot);
                                        setShowSingleDeleteConfirm(true);
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
          )}
        </div>
      </div>

      {/* Single delete confirmation modal */}
      <Modal
        isOpen={showSingleDeleteConfirm}
        onClose={() => {
          setShowSingleDeleteConfirm(false);
          setLotToDelete(null);
        }}
        title="Delete Lot"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => {
                setShowSingleDeleteConfirm(false);
                setLotToDelete(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => lotToDelete && handleDeleteLot(lotToDelete.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
            >
              Delete Lot
            </button>
          </div>
        }
      >
        {lotToDelete && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Are you sure you want to delete this lot? This action cannot be undone.
            </p>
            <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
              <div>
                <span className="font-medium">Condition:</span>{" "}
                {CONDITION_LABELS[lotToDelete.condition as keyof typeof CONDITION_LABELS] || lotToDelete.condition}
              </div>
              <div>
                <span className="font-medium">Quantity:</span> {lotToDelete.available_qty} / {lotToDelete.quantity}
                {lotToDelete.sold_qty > 0 && (
                  <span className="text-gray-500 ml-1">
                    ({lotToDelete.sold_qty} sold)
                  </span>
                )}
              </div>
              <div>
                <span className="font-medium">Status:</span> {lotToDelete.status}
              </div>
              {lotToDelete.for_sale && lotToDelete.list_price_pence != null && (
                <div>
                  <span className="font-medium">Price:</span> £{penceToPounds(lotToDelete.list_price_pence)}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              This will also delete all associated photos, eBay listings, and sales records for this lot.
            </p>
          </div>
        )}
      </Modal>

      {/* Bulk delete confirmation modal */}
      <Modal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        title="Delete Multiple Lots"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
            >
              Delete {selectedLots.size} Lot{selectedLots.size !== 1 ? "s" : ""}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{selectedLots.size}</strong> lot{selectedLots.size !== 1 ? "s" : ""}? This action cannot be undone.
          </p>
          <p className="text-xs text-gray-500">
            This will also delete all associated photos, eBay listings, and sales records for these lots.
          </p>
        </div>
      </Modal>

      {/* Lot Detail Modal */}
      {selectedLot && (
        <LotDetailModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
          onLotUpdated={() => {
            setSelectedLot(null);
            onLotsChanged?.();
          }}
          onPhotoCountChanged={(lotId, newCount) => {
            // Update the photo count for the specific lot in the local state
            setLots((prev) =>
              prev.map((lot) =>
                lot.id === lotId ? { ...lot, photo_count: newCount } : lot
              )
            );
          }}
        />
      )}
    </>
  );
}

