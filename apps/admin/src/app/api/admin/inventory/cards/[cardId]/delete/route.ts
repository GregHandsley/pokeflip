import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { cardId } = await params;
    const supabase = supabaseServer();

    // First, get all lot IDs for this card to delete related records
    const { data: lots, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("card_id", cardId);

    if (fetchError) {
      logger.error("Failed to fetch lots to delete", fetchError, undefined, { cardId });
      return createErrorResponse(
        fetchError.message || "Failed to fetch lots",
        500,
        "FETCH_LOTS_FAILED",
        fetchError
      );
    }

    if (!lots || lots.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No inventory found for this card",
      });
    }

    const lotIds = lots.map((l) => l.id);

    // Delete all related records explicitly to keep database lean
    // Delete lot photos
    const { error: photosError } = await supabase
      .from("lot_photos")
      .delete()
      .in("lot_id", lotIds);
    if (photosError) {
      logger.warn("Failed to delete lot photos", photosError, undefined, { cardId, lotIdsCount: lotIds.length });
    }
    
    // Delete eBay listings
    const { error: ebayError } = await supabase
      .from("ebay_listings")
      .delete()
      .in("lot_id", lotIds);
    if (ebayError) {
      logger.warn("Failed to delete eBay listings", ebayError, undefined, { cardId, lotIdsCount: lotIds.length });
    }
    
    // Delete sales_items to keep database lean (as requested)
    // This removes historical sales data for these lots
    const { error: salesError } = await supabase
      .from("sales_items")
      .delete()
      .in("lot_id", lotIds);
    if (salesError) {
      logger.warn("Failed to delete sales items", salesError, undefined, { cardId, lotIdsCount: lotIds.length });
    }

    // Delete all inventory lots for this card
    // This is the main deletion - cascade will handle some, but we've been explicit above
    const { error } = await supabase
      .from("inventory_lots")
      .delete()
      .eq("card_id", cardId);

    if (error) {
      logger.error("Failed to delete inventory lots", error, undefined, { cardId, lotIdsCount: lotIds.length });
      return createErrorResponse(
        error.message || "Failed to delete inventory",
        500,
        "DELETE_INVENTORY_LOTS_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Inventory deleted successfully",
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "delete_inventory_card", metadata: { cardId } });
  }
}

