"use client";

import { useState, useEffect } from "react";
import { penceToPounds } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import LotDetailModal from "./LotDetailModal";
import MarkSoldModal from "./MarkSoldModal";
import SalesFlowModal from "@/components/inbox/sales-flow/SalesFlowModal";
import { InboxLot } from "@/components/inbox/sales-flow/types";
import SplitModal from "@/components/ui/SplitModal";
import MergeLotsModal from "./MergeLotsModal";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { variationLabel } from "./variations";
import { supabaseBrowser } from "@/lib/supabase/browser";
import CardAnalyticsPanel from "../analytics/CardAnalyticsPanel";

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
  variation?: string | null;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  sku: string | null;
  photo_count: number;
  use_api_image?: boolean;
  purchase: Purchase | null; // Backwards compatibility
  purchases?: Array<Purchase & { quantity: number }>; // New: multiple purchases
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

// Function to determine the display status for a lot
function getDisplayStatus(lot: Lot): { label: string; color: string } {
  // Priority 1: Sold/Archived status
  if (lot.status === "sold") {
    return { label: "Sold", color: STATUS_COLORS.sold };
  }
  if (lot.status === "archived") {
    return { label: "Archived", color: STATUS_COLORS.archived };
  }

  // Fallback: Show lot status
  return {
    label: lot.status === "ready" ? "Ready to list" : lot.status.charAt(0).toUpperCase() + lot.status.slice(1),
    color: STATUS_COLORS[lot.status] || STATUS_COLORS.draft,
  };
}

type SalesItem = {
  id: string;
  qty: number;
  sold_price_pence: number;
  sold_at: string;
  order_group: string | null;
  platform: string;
  platform_order_ref: string | null;
  buyer_handle: string | null;
  created_at: string;
};

export default function CardLotsView({ cardId, isExpanded, onLotsChanged }: Props) {
  const supabase = supabaseBrowser();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardName, setCardName] = useState<string>("");
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotToMarkSold, setLotToMarkSold] = useState<Lot | null>(null);
  const [soldLotsExpanded, setSoldLotsExpanded] = useState(false);
  const [activeLotSoldItemsExpanded, setActiveLotSoldItemsExpanded] = useState<Set<string>>(new Set());
  const [salesItemsByLot, setSalesItemsByLot] = useState<Map<string, SalesItem[]>>(new Map());
  const [loadingSalesItems, setLoadingSalesItems] = useState<Set<string>>(new Set());
  const [lotToSplit, setLotToSplit] = useState<Lot | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [merging, setMerging] = useState(false);
  const [lotForSalesFlow, setLotForSalesFlow] = useState<InboxLot | null>(null);
  const [updatingForSale, setUpdatingForSale] = useState(false);

  const [cardData, setCardData] = useState<{
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    image_url: string | null;
    set: { id: string; name: string } | null;
  } | null>(null);

  const loadLots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/cards/${cardId}/lots`);
      const json = await res.json();
      if (json.ok) {
        setLots(json.lots || []);
        // Store card data for use in modals
        if (json.card) {
          setCardData(json.card);
          setCardName(json.card.name || "");
        }
      }
    } catch (e) {
      console.error("Failed to load cards:", e);
    } finally {
      setLoading(false);
    }
  };

  // Convert Lot to InboxLot format for SalesFlowModal
  const convertLotToInboxLot = async (lot: Lot): Promise<InboxLot | null> => {
    try {
      // Fetch card data with set information
      const { data: card, error: cardError } = await supabase
        .from("cards")
        .select(`
          id,
          number,
          name,
          rarity,
          api_image_url,
          set_id,
          sets (
            id,
            name
          )
        `)
        .eq("id", cardId)
        .single();

      if (cardError || !card) {
        console.error("Error fetching card:", cardError);
        return null;
      }

      const set = (card.sets as any) || null;

      // Get photo counts
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("kind")
        .eq("lot_id", lot.id)
        .in("kind", ["front", "back"]);

      const hasFrontPhoto = photos?.some((p) => p.kind === "front") || false;
      const hasBackPhoto = photos?.some((p) => p.kind === "back") || false;
      const hasRequiredPhotos = hasFrontPhoto && hasBackPhoto;

      // Get API image URL from card
      const apiImageUrl = (card as any).api_image_url || null;

      const inboxLot: InboxLot = {
        lot_id: lot.id,
        card_id: cardId,
        card_number: card.number || "",
        card_name: card.name || "",
        set_name: set?.name || "",
        rarity: card.rarity || null,
        condition: lot.condition,
        variation: lot.variation || "standard",
        status: lot.status,
        for_sale: lot.for_sale,
        list_price_pence: lot.list_price_pence,
        quantity: lot.quantity,
        available_qty: lot.available_qty,
        photo_count: lot.photo_count,
        use_api_image: lot.use_api_image || false,
        api_image_url: apiImageUrl,
        has_front_photo: hasFrontPhoto,
        has_back_photo: hasBackPhoto,
        has_required_photos: hasRequiredPhotos,
      };

      return inboxLot;
    } catch (e) {
      console.error("Error converting lot to InboxLot:", e);
      return null;
    }
  };

  const handleLotClick = async (lot: Lot) => {
    // If marked as "not for sale", open Lot Detail modal to allow marking as for sale
    if (!lot.for_sale) {
      setSelectedLot(lot);
      return;
    }

    // If status is "listed", open Mark as Sold modal
    if (lot.status === "listed") {
      setLotToMarkSold(lot);
      return;
    }

    // If status is "ready" (in inbox), open Sales Flow modal
    if (lot.status === "ready") {
      const inboxLot = await convertLotToInboxLot(lot);
      if (inboxLot) {
        setLotForSalesFlow(inboxLot);
      } else {
        // Fallback to detail modal if conversion fails
        setSelectedLot(lot);
      }
      return;
    }

    // Otherwise, open detail modal (default behavior)
    setSelectedLot(lot);
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
        throw new Error(json.error || "Failed to delete card");
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
      alert(e.message || "Failed to delete card");
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
      alert("Failed to delete some cards");
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

  const toggleActiveLotSoldItems = async (lotId: string) => {
    const isExpanded = activeLotSoldItemsExpanded.has(lotId);
    if (isExpanded) {
      // Collapse
      setActiveLotSoldItemsExpanded((prev) => {
        const next = new Set(prev);
        next.delete(lotId);
        return next;
      });
    } else {
      // Expand - load sales items if not already loaded
      setActiveLotSoldItemsExpanded((prev) => new Set(prev).add(lotId));
      
      if (!salesItemsByLot.has(lotId)) {
        setLoadingSalesItems((prev) => new Set(prev).add(lotId));
        try {
          const res = await fetch(`/api/admin/lots/${lotId}/sales`);
          const json = await res.json();
          if (json.ok) {
            setSalesItemsByLot((prev) => {
              const next = new Map(prev);
              next.set(lotId, json.sales_items || []);
              return next;
            });
          }
        } catch (e) {
          console.error("Failed to load sales items:", e);
        } finally {
          setLoadingSalesItems((prev) => {
            const next = new Set(prev);
            next.delete(lotId);
            return next;
          });
        }
      }
    }
  };

  if (!isExpanded) return null;

  if (loading) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">Loading cards...</div>
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-500">No cards found</div>
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

  // Check if selected lots can be merged (same SKU, no sold items, active status)
  // Using SKU ensures same card + condition + variation (as SKU is unique per combination)
  const canMergeSelected = (() => {
    if (selectedLots.size < 2) return false;
    const selectedLotsArray = lots.filter((lot) => selectedLots.has(lot.id));
    
    // Check all have the same SKU (ensures same card, condition, and variation)
    const firstLot = selectedLotsArray[0];
    const allSameSku = selectedLotsArray.every(
      (lot) => lot.sku && firstLot.sku && lot.sku === firstLot.sku
    );
    
    // Check all are active (not sold/archived)
    const allActive = selectedLotsArray.every(
      (lot) => lot.status !== "sold" && lot.status !== "archived"
    );
    
    // Check none have sold items
    const noneHaveSales = selectedLotsArray.every((lot) => lot.sold_qty === 0);
    
    return allSameSku && allActive && noneHaveSales;
  })();

  const handleMerge = async (targetLotId: string) => {
    setMerging(true);
    try {
      const lotIds = Array.from(selectedLots);
      const res = await fetch("/api/admin/lots/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_ids: lotIds,
          target_lot_id: targetLotId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to merge cards");
      }

      setSelectedLots(new Set());
      setShowMergeModal(false);
      loadLots();
      onLotsChanged?.();
    } catch (e: any) {
      alert(e.message || "Failed to merge cards");
      throw e;
    } finally {
      setMerging(false);
    }
  };

  const handleBulkUpdateForSale = async (forSale: boolean) => {
    if (selectedLots.size === 0) return;

    setUpdatingForSale(true);
    try {
      const lotIds = Array.from(selectedLots);
      
      // Update each lot individually using the existing API endpoint
      const results = await Promise.allSettled(
        lotIds.map((lotId) =>
          fetch(`/api/admin/lots/${lotId}/for-sale`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ for_sale: forSale }),
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        alert(`Failed to update ${failed} card(s). Please try again.`);
      }

      setSelectedLots(new Set());
      loadLots();
      onLotsChanged?.();
    } catch (e: any) {
      alert(e.message || "Failed to update for sale status");
    } finally {
      setUpdatingForSale(false);
    }
  };

  return (
    <>
      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500">Card analytics</div>
            <div className="text-base font-semibold">{cardName || "Card"}</div>
          </div>
        </div>
        <CardAnalyticsPanel cardId={cardId} />
      </div>

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
                Cards ({lots.length})
                {selectedLots.size > 0 && (
                  <span className="text-blue-600 ml-1">
                    • {selectedLots.size} selected
                  </span>
                )}
              </span>
            </button>
          </div>
          {selectedLots.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkUpdateForSale(true)}
                disabled={updatingForSale}
                className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updatingForSale ? "Updating..." : "Mark For Sale"}
              </button>
              <button
                onClick={() => handleBulkUpdateForSale(false)}
                disabled={updatingForSale}
                className="px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updatingForSale ? "Updating..." : "Mark Not For Sale"}
              </button>
              {canMergeSelected && (
                <button
                  onClick={() => setShowMergeModal(true)}
                  disabled={merging || updatingForSale}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Merge
                </button>
              )}
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={deletingLotId === "bulk" || updatingForSale}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingLotId === "bulk" ? "Deleting..." : `Delete ${selectedLots.size} card${selectedLots.size !== 1 ? "s" : ""}`}
              </button>
            </div>
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
                        onClick={() => handleLotClick(lot)}
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
                              {lot.for_sale && lot.list_price_pence != null && (
                                <span className="text-green-600 font-medium text-xs">
                                  £{penceToPounds(lot.list_price_pence)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {(() => {
                                const missingPhotos = !lot.use_api_image && (!lot.photo_count || lot.photo_count < 2);
                                if (missingPhotos) {
                                  return (
                                    <span
                                      className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"
                                      title="Add front and back photos"
                                    >
                                      Missing photos
                                    </span>
                                  );
                                }
                                const displayStatus = getDisplayStatus(lot);
                                return (
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${displayStatus.color}`}
                                    title={`Status: ${displayStatus.label}`}
                                  >
                                    {displayStatus.label}
                                  </span>
                                );
                              })()}
                              {!lot.for_sale && (
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
                                <span className="text-gray-500 text-xs" title={`${lot.photo_count} photo${lot.photo_count !== 1 ? "s" : ""}`}>
                                  📷 {lot.photo_count}
                                </span>
                              ) : null}
                              {/* Split button - only show for active lots with quantity > 1 and available quantity > 1 */}
                              {lot.status !== "sold" && lot.status !== "archived" && lot.available_qty > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLotToSplit(lot);
                                  }}
                                  className="ml-1 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                  title="Split quantity"
                                >
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
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                  </svg>
                                </button>
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
                          {/* Show purchase history if available, otherwise fallback to single purchase */}
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
                                  {p.quantity > 1 && (
                                    <span className="text-gray-500"> ({p.quantity})</span>
                                  )}
                                  {p.status === "closed" && (
                                    <span className="ml-1 text-gray-400">(closed)</span>
                                  )}
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
                          {lot.note && (
                            <div className="text-gray-500 italic text-xs">
                              {lot.note}
                            </div>
                          )}
                          {/* Sold items dropdown for active lots with sold quantities */}
                          {lot.sold_qty > 0 && lot.status !== "sold" && (
                            <div className="mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleActiveLotSoldItems(lot.id);
                                }}
                                className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900"
                              >
                                <span className="font-medium">
                                  Sold Items ({lot.sold_qty})
                                </span>
                                <svg
                                  className={`w-3 h-3 text-gray-400 transition-transform ${
                                    activeLotSoldItemsExpanded.has(lot.id) ? "rotate-180" : ""
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
                              {activeLotSoldItemsExpanded.has(lot.id) && (
                                <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
                                  {loadingSalesItems.has(lot.id) ? (
                                    <div className="text-xs text-gray-500">Loading sales...</div>
                                  ) : (
                                    (() => {
                                      const salesItems = salesItemsByLot.get(lot.id) || [];
                                      if (salesItems.length === 0) {
                                        return (
                                          <div className="text-xs text-gray-500">No sales found</div>
                                        );
                                      }
                                      return salesItems.map((item) => (
                                        <div
                                          key={item.id}
                                          className="text-xs bg-gray-50 rounded p-2 border border-gray-200"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-700">
                                                {item.qty} × £{penceToPounds(item.sold_price_pence)}
                                              </span>
                                              <span className="text-gray-500">
                                                = £{penceToPounds(item.qty * item.sold_price_pence)}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="mt-1 space-y-0.5 text-gray-600">
                                            {item.buyer_handle && (
                                              <div>
                                                <span className="font-medium">Buyer:</span> {item.buyer_handle}
                                              </div>
                                            )}
                                            {item.order_group && (
                                              <div>
                                                <span className="font-medium">Order:</span> {item.order_group}
                                              </div>
                                            )}
                                            <div>
                                              <span className="font-medium">Sold:</span>{" "}
                                              {new Date(item.sold_at).toLocaleDateString()}
                                            </div>
                                          </div>
                                        </div>
                                      ));
                                    })()
                                  )}
                                </div>
                              )}
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
                  Sold Cards ({soldLots.length})
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
                              className={`pl-3 pr-2 py-2 bg-gray-50 rounded border border-gray-200 opacity-75 cursor-pointer hover:bg-gray-100`}
                              onClick={async () => {
                                // Find sales order for this lot
                                try {
                                  const res = await fetch(`/api/admin/lots/${lot.id}/sales-order`);
                                  const json = await res.json();
                                  if (json.ok && json.salesOrderId) {
                                    // Navigate to sales page with order ID
                                    window.location.href = `/admin/sales?orderId=${json.salesOrderId}`;
                                  }
                                } catch (e) {
                                  console.error("Failed to get sales order:", e);
                                }
                              }}
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
        title="Delete Card"
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
              Delete Card
            </button>
          </div>
        }
      >
        {lotToDelete && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Are you sure you want to delete this card? This action cannot be undone.
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
              This will also delete all associated photos, eBay listings, and sales records for this card.
            </p>
          </div>
        )}
      </Modal>

      {/* Bulk delete confirmation modal */}
      <Modal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        title="Delete Multiple Cards"
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
              Delete {selectedLots.size} Card{selectedLots.size !== 1 ? "s" : ""}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{selectedLots.size}</strong> card{selectedLots.size !== 1 ? "s" : ""}? This action cannot be undone.
          </p>
          <p className="text-xs text-gray-500">
            This will also delete all associated photos, eBay listings, and sales records for these cards.
          </p>
        </div>
      </Modal>

      {/* Lot Detail Modal */}
      {selectedLot && cardData && (
        <LotDetailModal
          lot={{
            ...selectedLot,
            card_id: cardId,
            card: {
              id: cardData.id,
              number: cardData.number,
              name: cardData.name,
              rarity: cardData.rarity,
              image_url: cardData.image_url,
              set: cardData.set,
            },
          }}
          onClose={() => setSelectedLot(null)}
          onLotUpdated={() => {
            setSelectedLot(null);
            loadLots();
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

      {/* Mark Sold Modal */}
      {lotToMarkSold && (
        <MarkSoldModal
          lot={lotToMarkSold}
          onClose={() => setLotToMarkSold(null)}
          onSaleCreated={() => {
            setLotToMarkSold(null);
            loadLots();
            onLotsChanged?.();
          }}
        />
      )}

      {/* Split Modal */}
      {lotToSplit && (
        <SplitModal
          isOpen={!!lotToSplit}
          onClose={() => setLotToSplit(null)}
          onSplit={async (splitQty, forSale, price, condition) => {
            try {
              const res = await fetch(`/api/admin/lots/${lotToSplit.id}/split`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  split_qty: splitQty,
                  for_sale: forSale,
                  list_price_pence: price,
                  condition: condition,
                }),
              });

              const json = await res.json();
              if (!res.ok) {
                throw new Error(json.error || "Failed to split card");
              }

              setLotToSplit(null);
              loadLots();
              onLotsChanged?.();
            } catch (e: any) {
              alert(e.message || "Failed to split card");
              throw e;
            }
          }}
          currentQuantity={lotToSplit.available_qty}
          currentForSale={lotToSplit.for_sale}
          currentPrice={lotToSplit.list_price_pence}
          currentCondition={lotToSplit.condition}
          title={`Split Card`}
        />
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <MergeLotsModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          onMerge={handleMerge}
          lots={lots.filter((lot) => selectedLots.has(lot.id))}
          cardName={cardName || "Card"}
        />
      )}

      {/* Sales Flow Modal */}
      {lotForSalesFlow && (
        <SalesFlowModal
          lot={lotForSalesFlow}
          onClose={() => setLotForSalesFlow(null)}
          onUpdated={() => {
            setLotForSalesFlow(null);
            loadLots();
            onLotsChanged?.();
          }}
        />
      )}
    </>
  );
}

