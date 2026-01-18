export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);
  const { lotId } = await params;

  try {
    const supabase = supabaseServer();

    // Fetch the lot with card and set info
    const { data: lot, error: lotError } = await supabase
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
      .eq("id", lotId)
      .single();

    if (lotError || !lot) {
      logger.error("Failed to fetch lot", lotError, undefined, { lotId });
      return createErrorResponse(
        lotError?.message || "Lot not found",
        404,
        "LOT_NOT_FOUND",
        lotError
      );
    }

    // Get sold quantities from sales_items
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("qty")
      .eq("lot_id", lotId);

    const soldQty = (soldItems || []).reduce((sum, item) => sum + (item.qty || 0), 0);
    const availableQty = Math.max(0, (lot.quantity || 0) - soldQty);

    // Get eBay listing status
    const { data: ebayListing } = await supabase
      .from("ebay_listings")
      .select("status")
      .eq("lot_id", lotId)
      .single();

    // Get photo count
    const { data: photos } = await supabase.from("lot_photos").select("id").eq("lot_id", lotId);

    // Get purchase (acquisition) info if available
    let purchase = null;
    if (lot.acquisition_id) {
      const { data: acq } = await supabase
        .from("acquisitions")
        .select("id, source_name, source_type, purchased_at, status")
        .eq("id", lot.acquisition_id)
        .single();

      if (acq) {
        purchase = {
          id: acq.id,
          source_name: acq.source_name,
          source_type: acq.source_type,
          purchased_at: acq.purchased_at,
          status: acq.status,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      lot: {
        id: lot.id,
        card_id: lot.card_id,
        condition: lot.condition,
        quantity: lot.quantity,
        available_qty: availableQty,
        sold_qty: soldQty,
        for_sale: lot.for_sale,
        list_price_pence: lot.list_price_pence,
        status: lot.status,
        note: lot.note,
        created_at: lot.created_at,
        updated_at: lot.updated_at,
        ebay_status: ebayListing?.status || "not_listed",
        photo_count: photos?.length || 0,
        purchase: purchase,
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
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_lot", metadata: { lotId } });
  }
}
