import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { logAudit, getCurrentUser } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);
  const { lotId } = await params;

  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);

  try {
    const supabase = supabaseServer();

    // Fetch lot data before deletion for audit logging
    const { data: lotData, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("id, card_id, quantity, condition, status, for_sale, list_price_pence")
      .eq("id", lotId)
      .single();

    if (fetchError) {
      logger.warn("Failed to fetch lot data for audit logging", undefined, {
        lotId,
        error: fetchError,
      });
    }

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

    // Log audit entry for lot deletion
    try {
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "delete_lot",
        entity_type: "inventory_lot",
        entity_id: lotId,
        old_values: lotData
          ? {
              card_id: lotData.card_id,
              quantity: lotData.quantity,
              condition: lotData.condition,
              status: lotData.status,
              for_sale: lotData.for_sale,
              list_price_pence: lotData.list_price_pence,
            }
          : null,
        new_values: null, // Deleted
        description: `Lot deleted (qty: ${lotData?.quantity || "unknown"})`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      // Don't fail the deletion if audit logging fails
      logger.warn("Failed to log audit entry for lot deletion", undefined, {
        lotId,
        error: auditError,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Lot deleted successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "delete_lot", metadata: { lotId } });
  }
}
