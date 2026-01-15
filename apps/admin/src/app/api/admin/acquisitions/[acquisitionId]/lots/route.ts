import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type PurchaseHistoryRow = {
  lot_id: string;
  quantity: number;
};

type LotIdRow = {
  id: string;
};

type LotWithCards = {
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
  acquisition_id: string | null;
  cards: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    api_image_url: string | null;
    sets: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type SoldItemRow = {
  id: string;
  lot_id: string;
  qty: number;
};

type PurchaseAllocationRow = {
  sales_item_id: string;
  acquisition_id: string;
  qty: number;
};

type EbayListingRow = {
  lot_id: string;
  status: string;
};

type PhotoRow = {
  lot_id: string;
};

// type DraftLineRow = {
//   id: string;
//   card_id: string;
//   set_id: string;
//   condition: string;
//   variation: string | null;
//   quantity: number;
//   for_sale: boolean;
//   list_price_pence: number | null;
//   note: string | null;
//   created_at: string;
//   cards: {
//     id: string;
//     number: string;
//     name: string;
//     rarity: string | null;
//     api_image_url: string | null;
//     sets: {
//       id: string;
//       name: string;
//     } | null;
//   } | null;
// };

type DraftLineQueryResult = {
  id: string;
  card_id: string;
  set_id: string;
  condition: string;
  variation: string | null;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  note: string | null;
  created_at: string;
  cards: Array<{
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    api_image_url: string | null;
    sets: Array<{
      id: string;
      name: string;
    }> | null;
  }>;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ acquisitionId: string }> }
) {
  const logger = createApiLogger(req);
  const { acquisitionId } = await params;

  try {
    const supabase = supabaseServer();

    // Fetch the acquisition/purchase info
    const { data: acquisition, error: acqError } = await supabase
      .from("acquisitions")
      .select("*")
      .eq("id", acquisitionId)
      .single();

    if (acqError || !acquisition) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // Fetch purchase history to find all lots that have cards from this purchase
    // This includes merged lots that may no longer have acquisition_id set
    const { data: purchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, quantity")
      .eq("acquisition_id", acquisitionId);

    if (historyError) {
      logger.error("Failed to fetch purchase history", historyError, undefined, { acquisitionId });
      return createErrorResponse(
        "Failed to fetch purchase history",
        500,
        "FETCH_PURCHASE_HISTORY_FAILED",
        historyError
      );
    }

    // Get all lot IDs from purchase history (these are the lots that have cards from this purchase)
    const historyLotIds = (purchaseHistory || []).map((ph: PurchaseHistoryRow) => ph.lot_id);

    // Also get lots that directly have this acquisition_id (for backwards compatibility)
    const { data: directLots, error: directLotsError } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("acquisition_id", acquisitionId);

    if (directLotsError) {
      logger.warn("Failed to fetch direct lots", undefined, {
        acquisitionId,
        error: directLotsError,
      });
    }

    const directLotIds = (directLots || []).map((l: LotIdRow) => l.id);

    // Combine both sets of lot IDs
    const allLotIds = [...new Set([...historyLotIds, ...directLotIds])];

    if (allLotIds.length === 0) {
      return NextResponse.json({
        ok: true,
        purchase: {
          id: acquisition.id,
          source_name: acquisition.source_name,
          source_type: acquisition.source_type,
          purchase_total_pence: acquisition.purchase_total_pence,
          purchased_at: acquisition.purchased_at,
          notes: acquisition.notes,
          status: acquisition.status,
          created_at: acquisition.created_at,
        },
        lots: [],
      });
    }

    // Fetch all lots (including merged ones)
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select(
        `
        *,
        cards (
          id,
          number,
          name,
          rarity,
          api_image_url,
          sets (
            id,
            name
          )
        )
      `
      )
      .in("id", allLotIds)
      .order("created_at", { ascending: false });

    if (lotsError) {
      logger.error("Failed to fetch cards", lotsError, undefined, { acquisitionId });
      return createErrorResponse(
        lotsError.message || "Failed to fetch cards",
        500,
        "FETCH_CARDS_FAILED",
        lotsError
      );
    }

    // Create a map of lot_id -> original quantity from this purchase
    const purchaseQuantityMap = new Map<string, number>();
    (purchaseHistory || []).forEach((ph: PurchaseHistoryRow) => {
      purchaseQuantityMap.set(ph.lot_id, ph.quantity);
    });

    // For lots that don't have purchase history but have acquisition_id, use their current quantity
    (lots || []).forEach((lot: LotWithCards) => {
      if (lot.acquisition_id === acquisitionId && !purchaseQuantityMap.has(lot.id)) {
        purchaseQuantityMap.set(lot.id, lot.quantity);
      }
    });

    const lotIds = (lots || []).map((l: LotWithCards) => l.id);

    // Get sold quantities from sales_items
    const soldItemsMap = new Map<string, number>();
    // Also track sold quantities by purchase (for merged lots)
    const soldByPurchaseMap = new Map<string, number>(); // lot_id -> qty sold from this purchase

    if (lotIds.length > 0) {
      const { data: soldItems } = await supabase
        .from("sales_items")
        .select("id, lot_id, qty")
        .in("lot_id", lotIds);

      const soldItemIds = (soldItems || []).map((si: SoldItemRow) => si.id);

      // Get purchase allocations for sold items to track which purchase they came from
      if (soldItemIds.length > 0) {
        const { data: purchaseAllocations } = await supabase
          .from("sales_item_purchase_allocations")
          .select("sales_item_id, acquisition_id, qty")
          .in("sales_item_id", soldItemIds)
          .eq("acquisition_id", acquisitionId);

        // Map sales_item_id to lot_id
        const salesItemToLotMap = new Map<string, string>();
        (soldItems || []).forEach((si: SoldItemRow) => {
          salesItemToLotMap.set(si.id, si.lot_id);
        });

        // Track sold quantities from this purchase per lot
        (purchaseAllocations || []).forEach((alloc: PurchaseAllocationRow) => {
          const lotId = salesItemToLotMap.get(alloc.sales_item_id);
          if (lotId) {
            const current = soldByPurchaseMap.get(lotId) || 0;
            soldByPurchaseMap.set(lotId, current + (alloc.qty || 0));
          }
        });
      }

      // Also track total sold per lot (for backwards compatibility with items without allocations)
      (soldItems || []).forEach((item: SoldItemRow) => {
        const current = soldItemsMap.get(item.lot_id) || 0;
        soldItemsMap.set(item.lot_id, current + (item.qty || 0));
      });
    }

    // Get eBay listing statuses
    const ebayMap = new Map();
    if (lotIds.length > 0) {
      const { data: ebayListings } = await supabase
        .from("ebay_listings")
        .select("lot_id, status")
        .in("lot_id", lotIds);

      (ebayListings || []).forEach((listing: EbayListingRow) => {
        ebayMap.set(listing.lot_id, listing.status);
      });
    }

    // Get photo counts
    const photoCountsMap = new Map<string, number>();
    if (lotIds.length > 0) {
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("lot_id")
        .in("lot_id", lotIds);

      (photos || []).forEach((photo: PhotoRow) => {
        const current = photoCountsMap.get(photo.lot_id) || 0;
        photoCountsMap.set(photo.lot_id, current + 1);
      });
    }

    // Format lots with available qty and related data
    // Use original quantity from this purchase (from purchase history) for display
    const formattedLots = (lots || []).map((lot: LotWithCards) => {
      // Get the original quantity from this purchase (before merge)
      const originalQtyFromPurchase = purchaseQuantityMap.get(lot.id) || lot.quantity;

      // Get sold quantity from this purchase (using purchase allocations if available)
      let soldQtyFromPurchase = soldByPurchaseMap.get(lot.id) || 0;

      // If no purchase allocation data, fall back to proportional calculation
      if (soldQtyFromPurchase === 0) {
        const totalSoldQty = soldItemsMap.get(lot.id) || 0;
        const currentLotQty = lot.quantity;
        if (currentLotQty > 0 && totalSoldQty > 0) {
          // Calculate proportion: how much of this lot came from this purchase
          const proportionFromPurchase = originalQtyFromPurchase / currentLotQty;
          soldQtyFromPurchase = Math.floor(totalSoldQty * proportionFromPurchase);
        }
      }

      const availableQtyFromPurchase = Math.max(0, originalQtyFromPurchase - soldQtyFromPurchase);

      return {
        id: lot.id,
        card_id: lot.card_id,
        condition: lot.condition,
        variation: lot.variation || null,
        quantity: originalQtyFromPurchase, // Show original quantity from this purchase
        available_qty: availableQtyFromPurchase, // Available from this purchase
        sold_qty: soldQtyFromPurchase, // Sold from this purchase
        for_sale: lot.for_sale,
        list_price_pence: lot.list_price_pence,
        status: lot.status,
        note: lot.note,
        created_at: lot.created_at,
        updated_at: lot.updated_at,
        ebay_status: ebayMap.get(lot.id) || "not_listed",
        photo_count: photoCountsMap.get(lot.id) || 0,
        is_merged: lot.acquisition_id !== acquisitionId, // Indicate if this is a merged lot
        card: lot.cards
          ? {
              id: lot.cards.id,
              number: lot.cards.number,
              name: lot.cards.name,
              rarity: lot.cards.rarity,
              image_url: lot.cards.api_image_url,
              set: lot.cards.sets
                ? {
                    id: lot.cards.sets.id,
                    name: lot.cards.sets.name,
                  }
                : null,
            }
          : null,
      };
    });

    // Also fetch draft intake lines to show uncommitted cards
    const { data: draftLines, error: draftError } = await supabase
      .from("intake_lines")
      .select(
        `
        id,
        card_id,
        set_id,
        condition,
        variation,
        quantity,
        for_sale,
        list_price_pence,
        note,
        created_at,
        cards (
          id,
          number,
          name,
          rarity,
          api_image_url,
          sets (
            id,
            name
          )
        )
      `
      )
      .eq("acquisition_id", acquisitionId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (draftError) {
      logger.warn("Failed to fetch draft lines", undefined, { acquisitionId, error: draftError });
    }

    // Format draft lines to match lot structure
    // Note: Supabase returns nested relations as arrays, so cards is an array
    const formattedDraftLines = (draftLines || []).map((line: DraftLineQueryResult) => {
      const card = Array.isArray(line.cards) && line.cards.length > 0 ? line.cards[0] : null;
      const set = card && Array.isArray(card.sets) && card.sets.length > 0 ? card.sets[0] : null;
      return {
        id: `draft-${line.id}`, // Prefix to distinguish from real lots
        card_id: line.card_id,
        condition: line.condition,
        variation: line.variation || null,
        quantity: line.quantity,
        available_qty: line.quantity, // All available since not committed
        sold_qty: 0, // None sold since not in inventory
        for_sale: line.for_sale,
        list_price_pence: line.list_price_pence,
        status: "draft" as const,
        note: line.note,
        created_at: line.created_at,
        updated_at: line.created_at,
        ebay_status: "not_listed" as const,
        photo_count: 0,
        is_draft: true, // Flag to indicate this is a draft line
        card: card
          ? {
              id: card.id,
              number: card.number,
              name: card.name,
              rarity: card.rarity,
              image_url: card.api_image_url,
              set: set
                ? {
                    id: set.id,
                    name: set.name,
                  }
                : null,
            }
          : null,
      };
    });

    // Combine committed lots and draft lines
    const allItems = [...formattedLots, ...formattedDraftLines];

    return NextResponse.json({
      ok: true,
      purchase: {
        id: acquisition.id,
        source_name: acquisition.source_name,
        source_type: acquisition.source_type,
        purchase_total_pence: acquisition.purchase_total_pence,
        purchased_at: acquisition.purchased_at,
        notes: acquisition.notes,
        status: acquisition.status,
        created_at: acquisition.created_at,
      },
      lots: allItems,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "fetch_purchase_lots",
      metadata: { acquisitionId },
    });
  }
}
