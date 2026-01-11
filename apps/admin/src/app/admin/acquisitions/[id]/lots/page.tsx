"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import PageHeader from "@/components/ui/PageHeader";
import { CardPicker } from "@/features/intake/CardPicker";
import { insertDraftLine } from "@/features/intake/intakeInsert";
import type { Condition } from "@/features/intake/types";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { variationLabel } from "@/components/inventory/variations";
import LotDetailModal from "@/components/inventory/LotDetailModal";
import MarkSoldModal from "@/components/inventory/MarkSoldModal";
import SplitModal from "@/components/ui/SplitModal";
import MergeLotsModal from "@/components/inventory/MergeLotsModal";
import SalesFlowModal from "@/components/inbox/sales-flow/SalesFlowModal";
import { InboxLot } from "@/components/inbox/sales-flow/types";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { logger } from "@/lib/logger";

type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type Lot = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
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
  is_draft?: boolean; // Flag to indicate this is a draft intake line
  card: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function PurchaseLotsPage() {
  const params = useParams();
  const purchaseId = params?.id as string;
  const supabase = supabaseBrowser();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [profitData, setProfitData] = useState<{
    purchase_cost_pence: number;
    revenue_pence: number;
    revenue_after_discount_pence?: number;
    consumables_cost_pence: number;
    total_costs_pence: number;
    net_profit_pence: number;
    margin_percent: number;
    roi_percent: number;
    cards_sold: number;
    cards_total: number;
  } | null>(null);
  const [loadingProfit, setLoadingProfit] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [lotToSplit, setLotToSplit] = useState<Lot | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [removingDraftId, setRemovingDraftId] = useState<string | null>(null);
  const [updatingForSale, setUpdatingForSale] = useState(false);
  const [lotForSalesFlow, setLotForSalesFlow] = useState<InboxLot | null>(null);
  const [lotToMarkSold, setLotToMarkSold] = useState<Lot | null>(null);

  useEffect(() => {
    if (purchaseId) {
      loadPurchaseLots();
      loadProfitData();
      loadDraftCount();
    }
  }, [purchaseId]);

  const loadPurchaseLots = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/acquisitions/${purchaseId}/lots`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load purchase");
      }
      if (json.ok) {
        setPurchase(json.purchase);
        setLots(json.lots || []);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load purchase");
    } finally {
      setLoading(false);
    }
  };

  const loadProfitData = async () => {
    setLoadingProfit(true);
    try {
      const res = await fetch(`/api/admin/acquisitions/${purchaseId}/profit`);
      const json = await res.json();
      if (json.ok && json.profit) {
        setProfitData(json.profit);
      }
    } catch (e: any) {
      logger.error("Failed to load profit data", e, undefined, { purchaseId });
    } finally {
      setLoadingProfit(false);
    }
  };

  const loadDraftCount = async () => {
    try {
      const { count, error } = await supabase
        .from("intake_lines")
        .select("*", { count: "exact", head: true })
        .eq("acquisition_id", purchaseId)
        .eq("status", "draft");
      
      if (!error && count !== null) {
        setDraftCount(count);
      }
    } catch (e: any) {
      logger.error("Failed to load draft count", e, undefined, { purchaseId });
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setToast(null);
    try {
      const { data, error } = await supabase.rpc("commit_acquisition", { 
        p_acquisition_id: purchaseId 
      } as any);
      
      if (error) {
        throw error;
      }
      
      setToast((data as any)?.message ?? "Cards committed to inventory");
      await loadPurchaseLots();
      await loadProfitData();
      await loadDraftCount();
    } catch (e: any) {
      setToast(e?.message ?? "Failed to commit cards");
    } finally {
      setCommitting(false);
    }
  };

  const handleRemoveDraft = async (lotId: string) => {
    // Extract the actual intake line ID from the draft lot ID
    const intakeLineId = lotId.replace("draft-", "");
    
    setRemovingDraftId(lotId);
    setToast(null);
    try {
      const { error } = await supabase
        .from("intake_lines")
        .delete()
        .eq("id", intakeLineId)
        .eq("acquisition_id", purchaseId)
        .eq("status", "draft");
      
      if (error) {
        throw error;
      }
      
      setToast("Uncommitted card removed");
      await loadPurchaseLots();
      await loadDraftCount();
    } catch (e: any) {
      setToast(e?.message ?? "Failed to remove card");
    } finally {
      setRemovingDraftId(null);
    }
  };

  const handleAddCard = async ({ setId, cardId, locale, condition, quantity, variation }: {
    setId: string;
    cardId: string;
    locale: string;
    condition: Condition;
    quantity: number;
    variation: string;
  }) => {
    setToast(null);
    const { error } = await insertDraftLine({
      acquisitionId: purchaseId,
      setId,
      cardId,
      locale: locale || "en",
      quantity,
      defaults: {
        condition,
        variation,
        forSale: true,
        listPricePounds: "",
      },
    });

    if (error) {
      setToast(error.message || "Failed to add card");
    } else {
      setToast("Card added to draft cart. Click 'Commit to Inventory' to save.");
      setShowAddModal(false);
      await loadDraftCount();
      await loadPurchaseLots(); // Reload to show the new draft card
    }
  };

  const handleCloseClick = () => {
    setShowMenu(false);
    setShowCloseModal(true);
  };

  const handleReopenClick = async () => {
    setShowMenu(false);
    setToast(null);
    const { error } = await (supabase.from("acquisitions") as any).update({ status: "open" }).eq("id", purchaseId);
    if (error) {
      setToast(error.message || "Failed to reopen purchase");
    } else {
      await loadPurchaseLots();
      await loadProfitData();
      await loadDraftCount();
      setToast("Purchase reopened");
    }
  };

  const confirmClose = async () => {
    setClosing(true);
    setToast(null);
    const { error } = await (supabase.from("acquisitions") as any).update({ status: "closed" }).eq("id", purchaseId);
    if (error) {
      setToast(error.message || "Failed to close purchase");
      setClosing(false);
    } else {
      setShowCloseModal(false);
      setClosing(false);
      await loadPurchaseLots();
      await loadProfitData();
      await loadDraftCount();
      setToast("Purchase closed");
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Purchase Cards" />
        <div className="text-sm text-gray-600 py-8 text-center">Loading...</div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div>
        <PageHeader title="Purchase Cards" />
        <div className="text-sm text-red-600 py-8 text-center">
          {error || "Purchase not found"}
        </div>
      </div>
    );
  }

  // Group lots by set and sort by card number
  const lotsBySet = lots.reduce((acc, lot) => {
    const setId = lot.card?.set?.id || "unknown";
    if (!acc[setId]) {
      acc[setId] = [];
    }
    acc[setId].push(lot);
    return acc;
  }, {} as Record<string, Lot[]>);

  // Sort cards within each set by card number
  Object.keys(lotsBySet).forEach((setId) => {
    lotsBySet[setId].sort((a, b) => {
      const numA = parseInt(a.card?.number || "0", 10) || 0;
      const numB = parseInt(b.card?.number || "0", 10) || 0;
      if (numA !== numB) {
        return numA - numB;
      }
      // If numbers are equal, sort by card name
      return (a.card?.name || "").localeCompare(b.card?.name || "");
    });
  });

  // Check if selected lots can be merged
  const canMergeSelected = (() => {
    if (selectedLots.size < 2) return false;
    const selectedLotsArray = lots.filter((lot) => selectedLots.has(lot.id));
    if (selectedLotsArray.length < 2) return false;

    // All must have same card_id, condition, and variation
    const first = selectedLotsArray[0];
    const allSameCard = selectedLotsArray.every(
      (lot) =>
        lot.card_id === first.card_id &&
        lot.condition === first.condition &&
        (lot.variation || "standard") === (first.variation || "standard")
    );

    // All must be active (not sold or archived)
    const allActive = selectedLotsArray.every(
      (lot) => lot.status !== "sold" && lot.status !== "archived"
    );

    // None can have sold items
    const noneHaveSales = selectedLotsArray.every((lot) => lot.sold_qty === 0);

    return allSameCard && allActive && noneHaveSales;
  })();

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

  const handleSplit = async (splitQty: number, forSale: boolean, price: string | null, condition?: string) => {
    if (!lotToSplit) return;
    try {
      const res = await fetch(`/api/admin/lots/${lotToSplit.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_qty: splitQty,
          for_sale: forSale,
          list_price_pence: price ? poundsToPence(price) : null,
          condition: condition,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to split lot");
      }

      setLotToSplit(null);
      await loadPurchaseLots();
      await loadProfitData();
      setToast("Lot split successfully");
    } catch (e: any) {
      setToast(e.message || "Failed to split lot");
      throw e;
    }
  };

  const handleMerge = async (targetLotId: string) => {
    const lotIds = Array.from(selectedLots);
    try {
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
        throw new Error(json.error || "Failed to merge lots");
      }

      setSelectedLots(new Set());
      setShowMergeModal(false);
      await loadPurchaseLots();
      await loadProfitData();
      setToast("Lots merged successfully");
    } catch (e: any) {
      setToast(e.message || "Failed to merge lots");
      throw e;
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
        setToast(`Failed to update ${failed} card(s). Please try again.`);
      } else {
        setToast(`Successfully updated ${lotIds.length} card(s)`);
      }

      setSelectedLots(new Set());
      await loadPurchaseLots();
      await loadProfitData();
    } catch (e: any) {
      setToast(e?.message ?? "Failed to update for sale status");
    } finally {
      setUpdatingForSale(false);
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
        .eq("id", lot.card_id)
        .single();

      if (cardError || !card) {
        logger.error("Error fetching card for InboxLot conversion", cardError, undefined, { cardId: lot.card_id });
        return null;
      }

      const set = (card as any).sets;

      // Get photos for this lot
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("kind")
        .eq("lot_id", lot.id);

      const photoKinds = new Set((photos || []).map((p: any) => p.kind));
      const hasFrontPhoto = photoKinds.has("front");
      const hasBackPhoto = photoKinds.has("back");
      const hasRequiredPhotos = hasFrontPhoto && hasBackPhoto;

      // Get API image URL from card
      const apiImageUrl = (card as any).api_image_url || null;

      const inboxLot: InboxLot = {
        lot_id: lot.id,
        card_id: lot.card_id,
        card_number: (card as any)?.number || "",
        card_name: (card as any)?.name || "",
        set_name: set?.name || "",
        rarity: (card as any)?.rarity || null,
        condition: lot.condition,
        variation: lot.variation || "standard",
        status: lot.status,
        for_sale: lot.for_sale,
        list_price_pence: lot.list_price_pence,
        quantity: lot.quantity,
        available_qty: lot.available_qty,
        photo_count: lot.photo_count,
        use_api_image: (lot as any).use_api_image || false,
        api_image_url: apiImageUrl,
        has_front_photo: hasFrontPhoto,
        has_back_photo: hasBackPhoto,
        has_required_photos: hasRequiredPhotos,
      };

      return inboxLot;
    } catch (e) {
      logger.error("Failed to convert lot to InboxLot", e, undefined, {
        lotId: lot.id,
        cardId: lot.card_id,
      });
      return null;
    }
  };

  // Handle lot click - determine which modal to open based on lot status
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

  return (
    <div>
      <PageHeader 
        title={`Purchase: ${purchase.source_name}`}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Add New Card
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                aria-label="More options"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                    {purchase.status === "open" ? (
                      <button
                        onClick={handleCloseClick}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Close Purchase
                      </button>
                    ) : (
                      <button
                        onClick={handleReopenClick}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Reopen Purchase
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />
      
      {/* Toast */}
      {toast && (
        <div className={`mb-6 rounded-lg px-4 py-2.5 text-sm font-medium ${
          toast.includes("Error") 
            ? "bg-red-50 text-red-700 border border-red-200" 
            : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {toast}
        </div>
      )}

      {/* Purchase Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Type:</span>{" "}
            <span className="font-medium capitalize">{purchase.source_type}</span>
          </div>
          <div>
            <span className="text-gray-600">Total:</span>{" "}
            <span className="font-medium">£{penceToPounds(purchase.purchase_total_pence)}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>{" "}
            <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
              purchase.status === "closed" ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"
            }`}>
              {purchase.status}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Cards:</span>{" "}
            <span className="font-medium">{lots.length}</span>
          </div>
        </div>
        {purchase.notes && (
          <div className="mt-3 text-sm text-gray-600 italic">{purchase.notes}</div>
        )}
      </div>

      {/* Profit/Loss Summary */}
      {profitData && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Profit & Loss</h3>
          {loadingProfit ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Purchase Cost</div>
                  <div className="text-lg font-semibold text-red-600">
                    £{penceToPounds(profitData.purchase_cost_pence)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Revenue</div>
                  <div className="text-lg font-semibold text-green-600">
                    £{penceToPounds(profitData.revenue_after_discount_pence ?? profitData.revenue_pence)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Consumables</div>
                  <div className="text-lg font-semibold text-orange-600">
                    £{penceToPounds(profitData.consumables_cost_pence)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Net Profit/Loss</div>
                  <div className={`text-lg font-bold ${
                    profitData.net_profit_pence >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    £{penceToPounds(profitData.net_profit_pence)}
                  </div>
                  <div className={`text-xs mt-1 ${
                    (profitData.margin_percent || 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {(profitData.margin_percent || 0) >= 0 ? "+" : ""}{(profitData.margin_percent || 0).toFixed(1)}% margin
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    (profitData.roi_percent || 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {(profitData.roi_percent || 0) >= 0 ? "+" : ""}{(profitData.roi_percent || 0).toFixed(1)}% ROI
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Cards sold: <span className="font-medium">{profitData.cards_sold}</span> of{" "}
                  <span className="font-medium">{profitData.cards_total}</span> 
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Actions */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        {draftCount > 0 && (
          <button
            onClick={handleCommit}
            disabled={committing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {committing ? "Committing..." : `Commit to Inventory (${draftCount})`}
          </button>
        )}
        {selectedLots.size >= 2 && canMergeSelected && (
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Merge Selected ({selectedLots.size})
          </button>
        )}
      </div>

      {/* Bulk Actions (when cards are selected) */}
      {selectedLots.size > 0 && (
        <div className="flex items-center gap-2 mb-6">
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
          <button
            onClick={() => setSelectedLots(new Set())}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded border border-gray-200 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Cards grouped by set */}
      {Object.keys(lotsBySet).length === 0 ? (
        <div className="text-sm text-gray-600 py-8 text-center">
          No cards in this purchase yet. Add cards and commit to create inventory entries.
        </div>
      ) : (
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
                      const canSplit = !isDraft && lot.status !== "sold" && lot.status !== "archived" && lot.available_qty > 1;
                      return (
                        <div
                          key={lot.id}
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
                                  toggleLotSelection(lot.id);
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
                              <img
                                src={`${lot.card.image_url}/low.webp`}
                                alt={`${lot.card.name} card`}
                                className={`h-16 w-auto rounded border border-gray-200 ${isDraft ? "" : "cursor-pointer"}`}
                                onClick={() => {
                                  if (!isDraft) {
                                    handleLotClick(lot);
                                  }
                                }}
                              />
                            )}
                            <div
                              className={`flex-1 min-w-0 ${isDraft ? "" : "cursor-pointer"}`}
                              onClick={() => {
                                if (!isDraft) {
                                  handleLotClick(lot);
                                }
                              }}
                            >
                              <div className="font-medium text-sm">
                                <span className="text-gray-500 font-normal">#{lot.card?.number}</span>{" "}
                                {lot.card?.name}
                                {isDraft && (
                                  <span className="ml-2 text-xs text-yellow-700 font-normal">
                                    (Not in inventory yet)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {lot.card?.rarity && (
                                  <span className="text-xs text-gray-500">{lot.card.rarity}</span>
                                )}
                                <span className="text-xs text-gray-600">
                                  {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition}
                                </span>
                                {lot.variation && lot.variation !== "standard" && (
                                  <span className="text-xs text-gray-600">
                                    • {variationLabel(lot.variation)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm space-y-1">
                              <div>
                                <span className="text-gray-600">Qty:</span>{" "}
                                <span className="font-medium">{lot.available_qty} / {lot.quantity}</span>
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
                                          handleRemoveDraft(lot.id);
                                        }
                                      }}
                                      disabled={removingDraftId === lot.id}
                                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                      title="Remove uncommitted card"
                                    >
                                      {removingDraftId === lot.id ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      )}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                      STATUS_COLORS[lot.status] || STATUS_COLORS.draft
                                    }`}>
                                      {lot.status === "ready" ? "Ready to list" : lot.status.charAt(0).toUpperCase() + lot.status.slice(1)}
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
                                      setLotToSplit(lot);
                                    }}
                                    className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
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
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">Add Card to Purchase</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <CardPicker onPickCard={handleAddCard} />
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedLot && (
        <LotDetailModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
          onLotUpdated={async () => {
            setSelectedLot(null);
            await loadPurchaseLots();
            await loadProfitData();
            loadDraftCount();
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

      {/* Split Modal */}
      {lotToSplit && (
        <SplitModal
          isOpen={!!lotToSplit}
          onClose={() => setLotToSplit(null)}
          onSplit={handleSplit}
          currentQuantity={lotToSplit.available_qty}
          currentForSale={lotToSplit.for_sale}
          currentPrice={lotToSplit.list_price_pence}
          currentCondition={lotToSplit.condition as any}
          title="Split Lot"
        />
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <MergeLotsModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          onMerge={handleMerge}
          lots={lots.filter((lot) => selectedLots.has(lot.id))}
          cardName={lots.find((lot) => selectedLots.has(lot.id))?.card?.name || "Card"}
        />
      )}

      {/* Sales Flow Modal */}
      {lotForSalesFlow && (
        <SalesFlowModal
          lot={lotForSalesFlow}
          onClose={() => setLotForSalesFlow(null)}
          onUpdated={() => {
            setLotForSalesFlow(null);
            loadPurchaseLots();
            loadProfitData();
            loadDraftCount();
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
            loadPurchaseLots();
            loadProfitData();
            loadDraftCount();
          }}
        />
      )}

      {/* Close Purchase Confirmation Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => {
          setShowCloseModal(false);
        }}
        title="Close Purchase"
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCloseModal(false);
              }}
              disabled={closing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmClose}
              disabled={closing}
            >
              {closing ? "Closing..." : "Close Purchase"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-gray-700">
            Are you sure you want to close this purchase?
          </p>
          {purchase && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="font-medium">{purchase.source_name}</div>
              <div className="text-gray-600 mt-1">
                {purchase.source_type} • £{penceToPounds(purchase.purchase_total_pence)}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Closing a purchase prevents adding new cards to it. You can reopen it later if needed.
          </p>
        </div>
      </Modal>
    </div>
  );
}

