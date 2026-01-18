import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

// type SetRow = {
//   id: string;
//   name: string;
// };

// type CardRow = {
//   id: string;
//   number: string;
//   name: string;
//   rarity: string | null;
//   api_image_url: string | null;
//   sets: SetRow[] | null;
// };

// type InventoryLotRow = {
//   id: string;
//   condition: string;
//   variation: string | null;
//   quantity: number;
//   for_sale: boolean;
//   list_price_pence: number | null;
//   status: string;
//   card_id: string;
//   acquisition_id: string | null;
//   cards: CardRow[] | null;
// };

type SalesItemRow = {
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

type PurchaseHistoryRow = {
  lot_id: string;
  acquisition_id: string;
  quantity: number;
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

type CardRow = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  api_image_url: string | null;
  sets: Array<{ id: string; name: string }> | null;
};

export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const supabase = supabaseServer();

    // Fetch all lots that are for sale (both "ready" and "listed" status)
    // Only include cards that are marked as for_sale = true
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select(
        `
        id,
        condition,
        variation,
        quantity,
        for_sale,
        list_price_pence,
        status,
        card_id,
        acquisition_id,
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
      .eq("for_sale", true)
      .in("status", ["ready", "listed"])
      .order("created_at", { ascending: false });

    if (lotsError) {
      logger.error("Failed to fetch listed lots", lotsError);
      return createErrorResponse(
        lotsError.message || "Failed to fetch listed lots",
        500,
        "FETCH_LOTS_FAILED",
        lotsError
      );
    }

    // Get sold quantities from sales_items
    const lotIds = (lots || []).map((l) => l.id);
    const soldItemsMap = new Map<string, number>();
    const bundleReservedMap = new Map<string, number>();

    if (lotIds.length > 0) {
      const { data: soldItems } = await supabase
        .from("sales_items")
        .select("lot_id, qty")
        .in("lot_id", lotIds);

      (soldItems || []).forEach((item: SalesItemRow) => {
        const current = soldItemsMap.get(item.lot_id) || 0;
        soldItemsMap.set(item.lot_id, current + (item.qty || 0));
      });

      // Get quantities reserved in bundles (only for active bundles)
      // Reserved quantity = bundle.quantity * bundle_item.quantity (total cards needed)
      const { data: activeBundles } = await supabase
        .from("bundles")
        .select("id, quantity")
        .eq("status", "active");

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
        });
      }
    }

    // Get purchase history for all lots
    const { data: purchaseHistory } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, acquisition_id, quantity")
      .in("lot_id", lotIds);

    const purchaseHistoryMap = new Map<
      string,
      Array<{ acquisition_id: string; quantity: number }>
    >();
    (purchaseHistory || []).forEach((ph: PurchaseHistoryRow) => {
      if (!purchaseHistoryMap.has(ph.lot_id)) {
        purchaseHistoryMap.set(ph.lot_id, []);
      }
      purchaseHistoryMap.get(ph.lot_id)!.push({
        acquisition_id: ph.acquisition_id,
        quantity: ph.quantity,
      });
    });

    // Get acquisition info
    const acquisitionIds = [
      ...new Set(
        (lots || [])
          .map((l) => l.acquisition_id)
          .filter(Boolean)
          .concat(
            (purchaseHistory || [])
              .map((ph: PurchaseHistoryRow) => ph.acquisition_id)
              .filter(Boolean)
          )
      ),
    ];

    const purchaseMap = new Map<string, AcquisitionRow>();
    if (acquisitionIds.length > 0) {
      const { data: acquisitions } = await supabase
        .from("acquisitions")
        .select("id, source_name, source_type, purchased_at, status")
        .in("id", acquisitionIds);

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

    // Identify lots with missing card relationships and fetch them in batch
    const lotsWithMissingCards = (lots || []).filter(
      (lot) => !lot.cards || !Array.isArray(lot.cards) || lot.cards.length === 0
    );
    const missingCardIds = [
      ...new Set(lotsWithMissingCards.map((lot) => lot.card_id).filter(Boolean)),
    ];

    const cardFallbackMap = new Map();
    if (missingCardIds.length > 0) {
      const { data: fallbackCards } = await supabase
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
        .in("id", missingCardIds);

      (fallbackCards || []).forEach((card: CardRow) => {
        cardFallbackMap.set(card.id, {
          id: card.id,
          number: card.number,
          name: card.name,
          rarity: card.rarity,
          api_image_url: card.api_image_url,
          set:
            card.sets && Array.isArray(card.sets) && card.sets.length > 0
              ? {
                  id: card.sets[0].id,
                  name: card.sets[0].name,
                }
              : null,
        });
      });
    }

    // Format lots with available quantity
    const formattedLots = (lots || [])
      .map((lot) => {
        const soldQty = soldItemsMap.get(lot.id) || 0;
        const bundleReservedQty = bundleReservedMap.get(lot.id) || 0;
        const availableQty = Math.max(0, lot.quantity - soldQty - bundleReservedQty);

        // Only return lots with available quantity
        if (availableQty <= 0) {
          return null;
        }

        // Get purchase history for this lot
        const history = purchaseHistoryMap.get(lot.id) || [];
        const purchases = history
          .map((h) => {
            const purchase = purchaseMap.get(h.acquisition_id);
            return purchase ? { ...purchase, quantity: h.quantity } : null;
          })
          .filter((p): p is PurchaseWithQuantity => p !== null);

        // Fallback to single purchase if no history
        const purchase = lot.acquisition_id ? purchaseMap.get(lot.acquisition_id) : null;
        const singlePurchase = purchase && purchases.length === 0 ? purchase : null;
        const allPurchases =
          purchases.length > 0
            ? purchases
            : singlePurchase
              ? [{ ...singlePurchase, quantity: lot.quantity }]
              : [];

        // Handle card relationship - Supabase returns cards as an array
        let cardData = null;
        if (lot.cards && Array.isArray(lot.cards) && lot.cards.length > 0) {
          const card = lot.cards[0];
          cardData = {
            id: card.id,
            number: card.number,
            name: card.name,
            rarity: card.rarity,
            api_image_url: card.api_image_url,
            set:
              card.sets && Array.isArray(card.sets) && card.sets.length > 0
                ? {
                    id: card.sets[0].id,
                    name: card.sets[0].name,
                  }
                : null,
          };
        } else if (lot.card_id && cardFallbackMap.has(lot.card_id)) {
          // Use fallback card data if relationship was missing
          cardData = cardFallbackMap.get(lot.card_id);
        }

        return {
          id: lot.id,
          condition: lot.condition,
          variation: lot.variation || "standard",
          quantity: lot.quantity,
          available_qty: availableQty,
          sold_qty: soldQty,
          for_sale: lot.for_sale, // Explicitly include for_sale in response
          list_price_pence: lot.list_price_pence,
          purchases: allPurchases, // Array of purchases with quantities
          card: cardData,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      lots: formattedLots,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_listed_lots" });
  }
}
