import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function DELETE(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);
  const { lotId } = await params;

  try {
    const supabase = supabaseServer();

    // Delete all related records explicitly to keep database lean
    // Delete lot photos (cascade should handle this, but being explicit)
    const { error: photosError } = await supabase.from("lot_photos").delete().eq("lot_id", lotId);
    if (photosError) {
      logger.warn("Failed to delete lot photos", undefined, { lotId, error: photosError });
    }

    // Delete eBay listings (cascade should handle this, but being explicit)
    const { error: ebayError } = await supabase.from("ebay_listings").delete().eq("lot_id", lotId);
    if (ebayError) {
      logger.warn("Failed to delete eBay listings", undefined, { lotId, error: ebayError });
    }

    // Delete sales_items to keep database lean
    // Note: This removes historical sales data for this lot
    const { error: salesError } = await supabase.from("sales_items").delete().eq("lot_id", lotId);
    if (salesError) {
      logger.warn("Failed to delete sales items", undefined, { lotId, error: salesError });
    }

    // Delete the inventory lot itself
    const { error } = await supabase.from("inventory_lots").delete().eq("id", lotId);

    if (error) {
      logger.error("Failed to delete inventory lot", error, undefined, { lotId });
      return createErrorResponse(
        error.message || "Failed to delete lot",
        500,
        "DELETE_LOT_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Lot deleted successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "delete_lot", metadata: { lotId } });
  }
}
