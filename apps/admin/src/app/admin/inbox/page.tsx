"use client";

import { useState, useEffect, useCallback } from "react";
// import { penceToPounds } from "@pokeflip/shared";
import PageHeader from "@/components/ui/PageHeader";
import InboxTable from "@/components/inbox/InboxTable";
import InboxFilters from "@/components/inbox/InboxFilters";
import InboxBulkActions from "@/components/inbox/InboxBulkActions";
import SalesFlowModal from "@/components/inbox/sales-flow/SalesFlowModal";
import { useRef } from "react";
import { logger } from "@/lib/logger";

type InboxLot = {
  lot_id: string;
  card_id: string;
  card_number: string;
  card_name: string;
  set_name: string;
  rarity: string | null;
  rarity_rank: number;
  condition: string;
  status: string;
  for_sale: boolean;
  list_price_pence: number | null;
  quantity: number;
  available_qty: number;
  photo_count: number;
  updated_at: string;
  created_at: string;
  use_api_image?: boolean;
  api_image_url?: string | null;
  has_front_photo?: boolean;
  has_back_photo?: boolean;
  has_required_photos?: boolean;
};

type SortOption = "price_desc" | "qty_desc" | "rarity_desc" | "updated_desc";

export default function InboxPage() {
  const minPriceRef = useRef<HTMLInputElement>(null);
  const [lots, setLots] = useState<InboxLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedLot, setSelectedLot] = useState<InboxLot | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Filters
  const [includeDraft, setIncludeDraft] = useState(false);
  const [sort, setSort] = useState<SortOption>("price_desc");
  const [minPrice, setMinPrice] = useState<string>("");
  const [rarity, setRarity] = useState<string>("");

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sort,
        ...(includeDraft && { includeDraft: "true" }),
        ...(minPrice && { minPrice }),
        ...(rarity && { rarity }),
      });

      const res = await fetch(`/api/admin/inbox/lots?${params}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load inbox lots");
      }

      setLots(json.data || []);
      setTotalCount(json.totalCount || 0);
    } catch (e: unknown) {
      logger.error("Failed to load inbox lots", e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sort, includeDraft, minPrice, rarity]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        minPriceRef.current?.focus();
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (selectedLot) {
          setSelectedLot(null);
        }
      }
      if (e.key === "e" || e.key === "m") {
        const firstSelected = lots.find((l) => selectedLotIds.has(l.lot_id)) || lots[0];
        if (firstSelected) {
          e.preventDefault();
          setSelectedLot(firstSelected);
        }
      }
      if (e.key === "c") {
        if (selectedLot) {
          e.preventDefault();
          setSelectedLot(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lots, selectedLotIds, selectedLot, showShortcuts]);

  const handleBulkAction = async (action: string, payload?: Record<string, unknown>) => {
    if (selectedLotIds.size === 0) {
      alert("Please select at least one lot");
      return;
    }

    try {
      const res = await fetch("/api/admin/inbox/lots/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lotIds: Array.from(selectedLotIds),
          ...(payload || {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.missingPhotoLotIds && json.missingPhotoLotIds.length > 0) {
          throw new Error(
            `${json.error}\n\nClick on the lot(s) in the table to add photos or enable API image.`
          );
        }
        throw new Error(json.error || "Bulk action failed");
      }

      // Clear selection and reload
      setSelectedLotIds(new Set());
      await loadLots();
      // Dispatch event to update inbox count in sidebar
      window.dispatchEvent(new CustomEvent("inboxUpdated"));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to perform bulk action");
    }
  };

  const hasSelection = selectedLotIds.size > 0;

  return (
    <div>
      <PageHeader title="Inbox" />
      <p className="text-sm text-gray-600 mb-6">
        Lots ready to list. Select items to update in bulk.
      </p>

      <InboxFilters
        includeDraft={includeDraft}
        onIncludeDraftChange={setIncludeDraft}
        sort={sort}
        onSortChange={setSort}
        minPrice={minPrice}
        onMinPriceChange={setMinPrice}
        rarity={rarity}
        onRarityChange={setRarity}
        minPriceInputId="inbox-min-price"
        minPriceRef={minPriceRef}
      />

      {hasSelection && (
        <InboxBulkActions
          selectedCount={selectedLotIds.size}
          onUpdatePrice={(price) => handleBulkAction("update_list_price", { list_price: price })}
          onMarkNotForSale={() => handleBulkAction("mark_not_for_sale", { for_sale: false })}
          onClearSelection={() => setSelectedLotIds(new Set())}
        />
      )}

      <InboxTable
        lots={lots}
        loading={loading}
        selectedLotIds={selectedLotIds}
        onSelectionChange={setSelectedLotIds}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onLotClick={setSelectedLot}
      />

      {selectedLot && (
        <SalesFlowModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
          onUpdated={loadLots}
        />
      )}

      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
              >
                ×
              </button>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                <span className="font-semibold">/</span> Focus min price filter
              </li>
              <li>
                <span className="font-semibold">e</span> Expand first selected lot
              </li>
              <li>
                <span className="font-semibold">m</span> Quick open selected lot (mark/list)
              </li>
              <li>
                <span className="font-semibold">c</span> Close open modal
              </li>
              <li>
                <span className="font-semibold">Esc</span> Close modal or shortcuts
              </li>
              <li>
                <span className="font-semibold">?</span> Toggle this help
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
