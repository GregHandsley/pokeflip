import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type InventoryLotRow = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  sku: string | null;
  ebay_publish_queued_at: string | null;
  use_api_image: boolean;
  acquisition_id: string | null;
};

type SoldItemRow = {
  lot_id: string;
  qty: number;
};

type BundleRow = {
  id: string;
  quantity: number;
};

type BundleItemRow = {
  lot_id: string;
  quantity: number;
  bundle_id: string;
};

type EbayListingRow = {
  lot_id: string;
  status: string;
};

type PhotoRow = {
  lot_id: string;
};

type PurchaseHistoryRow = {
  lot_id: string;
  acquisition_id: string;
  quantity: number;
};

type PurchaseHistoryAcquisitionRow = {
  acquisition_id: string;
};

type AcquisitionRow = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
};

type PurchaseWithQuantity = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
  quantity: number;
};

type JobPayload = {
  lotId?: string;
  [key: string]: unknown;
};

type JobRow = {
  payload: JobPayload | null;
  status: string;
};

export async function GET(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const logger = createApiLogger(req);

  // Extract cardId outside try block so it's available in catch
  const { cardId } = await params;

  try {
    const supabase = supabaseServer();

    // Fetch card data first
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(
        `
        id,
        number,
        name,
        rarity,
        api_image_url,
        sets (
          id,
          name
        )
      `
      )
      .eq("id", cardId)
      .single();

    if (cardError) {
      logger.error("Failed to fetch card", cardError, undefined, { cardId });
      return createErrorResponse(
        cardError.message || "Failed to fetch card",
        500,
        "FETCH_CARD_FAILED",
        cardError
      );
    }

    // Fetch all lots for this card
    const { data: lots, error } = await supabase
      .from("inventory_lots")
      .select("*")
      .eq("card_id", cardId)
      .order("condition", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch lots", error, undefined, { cardId });
      return createErrorResponse(
        error.message || "Failed to fetch lots",
        500,
        "FETCH_LOTS_FAILED",
        error
      );
    }

    if (!lots || lots.length === 0) {
      return NextResponse.json({
        ok: true,
        lots: [],
      });
    }

    // Get sold quantities from sales_items
    const lotIds = lots.map((l: InventoryLotRow) => l.id);
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lotIds);

    const soldItemsMap = new Map<string, number>();
    (soldItems || []).forEach((item: SoldItemRow) => {
      const current = soldItemsMap.get(item.lot_id) || 0;
      soldItemsMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Get quantities reserved in active bundles, and which bundles each lot is in
    // Reserved quantity = bundle.quantity * bundle_item.quantity (total cards needed across all bundles)
    const { data: activeBundles } = await supabase
      .from("bundles")
      .select("id, quantity")
      .eq("status", "active");

    const bundleReservedMap = new Map<string, number>();
    const lotBundlesMap = new Map<
      string,
      Array<{ bundleId: string; quantity: number; bundleQuantity: number }>
    >();
    if (activeBundles && activeBundles.length > 0) {
      const activeBundleIds = activeBundles.map((b: BundleRow) => b.id);
      const bundleQuantityMap = new Map<string, number>();
      activeBundles.forEach((b: BundleRow) => {
        bundleQuantityMap.set(b.id, b.quantity || 1);
      });

      const { data: bundleItems } = await supabase
        .from("bundle_items")
        .select("lot_id, quantity, bundle_id")
        .in("lot_id", lotIds)
        .in("bundle_id", activeBundleIds);

      (bundleItems || []).forEach((item: BundleItemRow) => {
        const bundleQty = bundleQuantityMap.get(item.bundle_id) || 1;
        const cardsPerBundle = item.quantity || 1;
        const totalReserved = bundleQty * cardsPerBundle;

        const current = bundleReservedMap.get(item.lot_id) || 0;
        bundleReservedMap.set(item.lot_id, current + totalReserved);

        // Track which bundles this lot is in
        if (!lotBundlesMap.has(item.lot_id)) {
          lotBundlesMap.set(item.lot_id, []);
        }
        lotBundlesMap.get(item.lot_id)!.push({
          bundleId: item.bundle_id,
          quantity: cardsPerBundle,
          bundleQuantity: bundleQty,
        });
      });
    }

    // Get eBay listing statuses and publish queue info
    const { data: ebayListings } = await supabase
      .from("ebay_listings")
      .select("lot_id, status")
      .in("lot_id", lotIds);

    const ebayMap = new Map<string, string>();
    (ebayListings || []).forEach((listing: EbayListingRow) => {
      ebayMap.set(listing.lot_id, listing.status);
    });

    // Get publish queue status from jobs table
    const { data: publishJobs } = await supabase
      .from("jobs")
      .select("payload, status")
      .eq("type", "ebay_publish")
      .in("status", ["queued", "running"]);

    const queuedLotIds = new Set(
      (publishJobs || [])
        .map((job: JobRow) => job.payload?.lotId)
        .filter((id): id is string => id != null && typeof id === "string" && lotIds.includes(id))
    );

    // Get photo counts
    const { data: photoCounts } = await supabase
      .from("lot_photos")
      .select("lot_id")
      .in("lot_id", lotIds);

    const photoCountsMap = new Map<string, number>();
    (photoCounts || []).forEach((photo: PhotoRow) => {
      const current = photoCountsMap.get(photo.lot_id) || 0;
      photoCountsMap.set(photo.lot_id, current + 1);
    });

    // Get purchase (acquisition) info for lots that have it
    const acquisitionIds = lots
      .map((l: InventoryLotRow) => l.acquisition_id)
      .filter((id): id is string => id != null);

    // Also get acquisition IDs from purchase history
    const { data: purchaseHistory } = await supabase
      .from("lot_purchase_history")
      .select("acquisition_id")
      .in("lot_id", lotIds);

    const historyAcquisitionIds = [
      ...new Set(
        (purchaseHistory || [])
          .map((ph: PurchaseHistoryAcquisitionRow) => ph.acquisition_id)
          .filter(Boolean)
      ),
    ];

    const allAcquisitionIds = [...new Set([...acquisitionIds, ...historyAcquisitionIds])];

    const purchaseMap = new Map<string, AcquisitionRow>();
    if (allAcquisitionIds.length > 0) {
      const { data: acquisitions } = await supabase
        .from("acquisitions")
        .select("id, source_name, source_type, purchased_at, status")
        .in("id", allAcquisitionIds);

      (acquisitions || []).forEach((acq: AcquisitionRow) => {
        purchaseMap.set(acq.id, {
          id: acq.id,
          source_name: acq.source_name,
          source_type: acq.source_type,
          purchased_at: acq.purchased_at,
          status: acq.status,
        });
      });
    }

    // Get purchase history for all lots
    const { data: allPurchaseHistory } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, acquisition_id, quantity")
      .in("lot_id", lotIds);

    const purchaseHistoryMap = new Map<
      string,
      Array<{ acquisition_id: string; quantity: number }>
    >();
    (allPurchaseHistory || []).forEach((ph: PurchaseHistoryRow) => {
      if (!purchaseHistoryMap.has(ph.lot_id)) {
        purchaseHistoryMap.set(ph.lot_id, []);
      }
      purchaseHistoryMap.get(ph.lot_id)!.push({
        acquisition_id: ph.acquisition_id,
        quantity: ph.quantity,
      });
    });

    // Format lots with available qty and related data
    const formattedLots = lots.map((lot: InventoryLotRow) => {
      const soldQty = soldItemsMap.get(lot.id) || 0;
      const bundleReservedQty = bundleReservedMap.get(lot.id) || 0;
      const availableQty = Math.max(0, lot.quantity - soldQty - bundleReservedQty);

      // If all quantity is reserved in bundles, the lot should not be available for individual sale
      const effectiveForSale = lot.for_sale && availableQty > 0;

      // Get purchase history for this lot
      const history = purchaseHistoryMap.get(lot.id) || [];
      const purchases = history
        .map((h) => {
          const purchase = purchaseMap.get(h.acquisition_id);
          return purchase ? { ...purchase, quantity: h.quantity } : null;
        })
        .filter((p): p is PurchaseWithQuantity => p !== null);

      // Fallback to single purchase if no history (for backwards compatibility)
      const purchase = lot.acquisition_id ? purchaseMap.get(lot.acquisition_id) : null;
      const singlePurchase = purchase && purchases.length === 0 ? purchase : null;

      const inBundles = lotBundlesMap.get(lot.id) || [];

      return {
        id: lot.id,
        condition: lot.condition,
        variation: lot.variation || "standard",
        quantity: lot.quantity,
        available_qty: availableQty,
        sold_qty: soldQty,
        bundle_reserved_qty: bundleReservedQty, // Quantity reserved in bundles
        in_bundles: inBundles.length > 0 ? inBundles : null, // Array of bundle IDs this lot is in
        for_sale: effectiveForSale, // Only true if lot is marked for sale AND has available quantity
        list_price_pence: lot.list_price_pence,
        status: lot.status,
        note: lot.note,
        created_at: lot.created_at,
        updated_at: lot.updated_at,
        sku: lot.sku || null,
        ebay_status: ebayMap.get(lot.id) || "not_listed",
        ebay_publish_queued_at: lot.ebay_publish_queued_at || null,
        is_queued: queuedLotIds.has(lot.id),
        photo_count: photoCountsMap.get(lot.id) || 0,
        use_api_image: lot.use_api_image || false,
        purchase: singlePurchase, // Keep for backwards compatibility
        purchases:
          purchases.length > 0
            ? purchases
            : singlePurchase
              ? [{ ...singlePurchase, quantity: lot.quantity }]
              : [], // New field with all purchases
      };
    });

    return NextResponse.json({
      ok: true,
      lots: formattedLots,
      card: card
        ? {
            id: card.id,
            number: card.number,
            name: card.name,
            rarity: card.rarity,
            image_url: card.api_image_url, // Use api_image_url as image_url for compatibility
            set:
              card.sets && Array.isArray(card.sets) && card.sets.length > 0
                ? {
                    id: card.sets[0].id,
                    name: card.sets[0].name,
                  }
                : null,
          }
        : null,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_card_lots", metadata: { cardId } });
  }
}
