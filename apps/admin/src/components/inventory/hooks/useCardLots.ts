import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { logger } from "@/lib/logger";
import { InboxLot } from "@/components/inbox/sales-flow/types";
import type { Lot, SalesItem, CardData } from "../CardLotsView.types";

export function useCardLots(cardId: string, isExpanded: boolean) {
  const supabase = supabaseBrowser();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardName, setCardName] = useState<string>("");
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotToMarkSold, setLotToMarkSold] = useState<Lot | null>(null);
  const [soldLotsExpanded, setSoldLotsExpanded] = useState(false);
  const [activeLotSoldItemsExpanded, setActiveLotSoldItemsExpanded] = useState<Set<string>>(
    new Set()
  );
  const [salesItemsByLot, setSalesItemsByLot] = useState<Map<string, SalesItem[]>>(new Map());
  const [loadingSalesItems, setLoadingSalesItems] = useState<Set<string>>(new Set());
  const [lotToSplit, setLotToSplit] = useState<Lot | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [merging, setMerging] = useState(false);
  const [lotForSalesFlow, setLotForSalesFlow] = useState<InboxLot | null>(null);
  const [updatingForSale, setUpdatingForSale] = useState(false);

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/cards/${cardId}/lots`);
      const json = await res.json();
      if (json.ok) {
        setLots(json.lots || []);
        if (json.card) {
          setCardData(json.card);
          setCardName(json.card.name || "");
        }
      }
    } catch (e) {
      logger.error("Failed to load cards", e, undefined, { cardId });
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (isExpanded) {
      void loadLots();
    } else {
      setLots([]);
      setSelectedLots(new Set());
    }
  }, [isExpanded, loadLots]);

  const convertLotToInboxLot = useCallback(
    async (lot: Lot): Promise<InboxLot | null> => {
      try {
        const { data: card, error: cardError } = await supabase
          .from("cards")
          .select(
            `
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
          `
          )
          .eq("id", cardId)
          .single();

        if (cardError || !card) {
          logger.error("Failed to fetch card for InboxLot conversion", cardError, undefined, {
            cardId,
            lotId: lot.id,
          });
          return null;
        }

        type CardWithSet = {
          id: string;
          number: string;
          name: string;
          rarity: string | null;
          api_image_url: string | null;
          sets: Array<{ id: string; name: string }> | null;
        };

        const typedCard = card as CardWithSet;
        const set = typedCard.sets && typedCard.sets.length > 0 ? typedCard.sets[0] : null;

        const { data: photos } = await supabase
          .from("lot_photos")
          .select("kind")
          .eq("lot_id", lot.id)
          .in("kind", ["front", "back"]);

        type PhotoRow = { kind: string };
        const typedPhotos = (photos ?? []) as PhotoRow[];

        const hasFrontPhoto = typedPhotos.some((p) => p.kind === "front");
        const hasBackPhoto = typedPhotos.some((p) => p.kind === "back");
        const hasRequiredPhotos = hasFrontPhoto && hasBackPhoto;

        const apiImageUrl = typedCard.api_image_url || null;

        const inboxLot: InboxLot = {
          lot_id: lot.id,
          card_id: cardId,
          card_number: typedCard.number || "",
          card_name: typedCard.name || "",
          set_name: set?.name || "",
          rarity: typedCard.rarity || null,
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
        logger.error("Failed to convert lot to InboxLot", e, undefined, {
          lotId: lot.id,
          cardId,
        });
        return null;
      }
    },
    [cardId, supabase]
  );

  const handleLotClick = useCallback(
    async (lot: Lot) => {
      if (!lot.for_sale || lot.available_qty <= 0) {
        setSelectedLot(lot);
        return;
      }

      if (lot.status === "listed") {
        setLotToMarkSold(lot);
        return;
      }

      if (lot.status === "ready") {
        const inboxLot = await convertLotToInboxLot(lot);
        if (inboxLot) {
          setLotForSalesFlow(inboxLot);
        } else {
          setSelectedLot(lot);
        }
        return;
      }

      setSelectedLot(lot);
    },
    [convertLotToInboxLot]
  );

  const toggleLotSelection = useCallback((lotId: string) => {
    setSelectedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedLots((prev) => {
      if (prev.size === lots.length) {
        return new Set();
      } else {
        return new Set(lots.map((l) => l.id));
      }
    });
  }, [lots]);

  const toggleActiveLotSoldItems = useCallback(
    async (lotId: string) => {
      const isExpanded = activeLotSoldItemsExpanded.has(lotId);
      if (isExpanded) {
        setActiveLotSoldItemsExpanded((prev) => {
          const next = new Set(prev);
          next.delete(lotId);
          return next;
        });
      } else {
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
            logger.error("Failed to load sales items", e, undefined, { lotId });
          } finally {
            setLoadingSalesItems((prev) => {
              const next = new Set(prev);
              next.delete(lotId);
              return next;
            });
          }
        }
      }
    },
    [activeLotSoldItemsExpanded, salesItemsByLot]
  );

  const handleDeleteLot = useCallback(async (lotId: string, onLotsChanged?: () => void) => {
    setDeletingLotId(lotId);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/delete`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete card");
      }

      setLots((prev) => prev.filter((l) => l.id !== lotId));
      setSelectedLots((prev) => {
        const next = new Set(prev);
        next.delete(lotId);
        return next;
      });

      onLotsChanged?.();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to delete card");
    } finally {
      setDeletingLotId(null);
      setShowSingleDeleteConfirm(false);
      setLotToDelete(null);
    }
  }, []);

  const handleBulkDelete = useCallback(
    async (onLotsChanged?: () => void) => {
      if (selectedLots.size === 0) return;

      const lotIds = Array.from(selectedLots);
      setDeletingLotId("bulk");
      try {
        await Promise.all(
          lotIds.map((lotId) => fetch(`/api/admin/lots/${lotId}/delete`, { method: "DELETE" }))
        );

        setLots((prev) => prev.filter((l) => !selectedLots.has(l.id)));
        setSelectedLots(new Set());

        onLotsChanged?.();
      } catch {
        alert("Failed to delete some cards");
      } finally {
        setDeletingLotId(null);
        setShowBulkDeleteConfirm(false);
      }
    },
    [selectedLots]
  );

  const handleMerge = useCallback(
    async (targetLotId: string, onLotsChanged?: () => void) => {
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
        await loadLots();
        onLotsChanged?.();
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        alert(error.message || "Failed to merge cards");
        throw e;
      } finally {
        setMerging(false);
      }
    },
    [selectedLots, loadLots]
  );

  const handleBulkUpdateForSale = useCallback(
    async (forSale: boolean, onLotsChanged?: () => void) => {
      if (selectedLots.size === 0) return;

      setUpdatingForSale(true);
      try {
        const lotIds = Array.from(selectedLots);

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
        await loadLots();
        onLotsChanged?.();
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        alert(error.message || "Failed to update for sale status");
      } finally {
        setUpdatingForSale(false);
      }
    },
    [selectedLots, loadLots]
  );

  const canMergeSelected = useCallback(() => {
    if (selectedLots.size < 2) return false;
    const selectedLotsArray = lots.filter((lot) => selectedLots.has(lot.id));

    const firstLot = selectedLotsArray[0];
    const allSameSku = selectedLotsArray.every(
      (lot) => lot.sku && firstLot.sku && lot.sku === firstLot.sku
    );

    const allActive = selectedLotsArray.every(
      (lot) => lot.status !== "sold" && lot.status !== "archived"
    );

    const noneHaveSales = selectedLotsArray.every((lot) => lot.sold_qty === 0);

    return allSameSku && allActive && noneHaveSales;
  }, [lots, selectedLots]);

  return {
    lots,
    loading,
    cardName,
    cardData,
    selectedLots,
    deletingLotId,
    showBulkDeleteConfirm,
    showSingleDeleteConfirm,
    lotToDelete,
    selectedLot,
    lotToMarkSold,
    soldLotsExpanded,
    activeLotSoldItemsExpanded,
    salesItemsByLot,
    loadingSalesItems,
    lotToSplit,
    showMergeModal,
    merging,
    lotForSalesFlow,
    updatingForSale,
    setLots,
    setSelectedLots,
    setDeletingLotId,
    setShowBulkDeleteConfirm,
    setShowSingleDeleteConfirm,
    setLotToDelete,
    setSelectedLot,
    setLotToMarkSold,
    setSoldLotsExpanded,
    setLotToSplit,
    setShowMergeModal,
    setMerging,
    setLotForSalesFlow,
    setUpdatingForSale,
    loadLots,
    handleLotClick,
    toggleLotSelection,
    toggleSelectAll,
    toggleActiveLotSoldItems,
    handleDeleteLot,
    handleBulkDelete,
    handleMerge,
    handleBulkUpdateForSale,
    canMergeSelected,
  };
}
