import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { logAudit, getCurrentUser } from "@/lib/audit";
import { uuid, lotStatus } from "@/lib/validation";

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    ready: "Ready",
    listed: "Listed",
    sold: "Sold",
    archived: "Archived",
  };
  return labels[status] || status;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);
  
  try {
    // Validate route parameters
    const { lotId } = await params;
    const validatedLotId = uuid(lotId, "lotId");
    
    // Validate request body
    const body = await req.json();
    const validatedStatus = lotStatus(body.status, "status");

    const supabase = supabaseServer();

    // Get current lot state for audit logging
    const { data: currentLot, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("status")
      .eq("id", validatedLotId)
      .single();

    if (fetchError) {
      logger.error("Failed to fetch lot for audit", fetchError, undefined, {
        lotId: validatedLotId,
      });
      // Continue anyway - audit logging is best effort
    }

    // Update the lot status
    const { error } = await supabase
      .from("inventory_lots")
      .update({ status: validatedStatus })
      .eq("id", validatedLotId);

    if (error) {
      logger.error("Failed to update lot status", error, undefined, {
        lotId: validatedLotId,
        status: validatedStatus,
      });
      return createErrorResponse(
        error.message || "Failed to update lot status",
        500,
        "UPDATE_LOT_STATUS_FAILED",
        error
      );
    }

    // Log audit entry for status change
    try {
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "change_status",
        entity_type: "inventory_lot",
        entity_id: validatedLotId,
        old_values: currentLot ? {
          status: currentLot.status,
        } : null,
        new_values: {
          status: validatedStatus,
        },
        description: `Status changed from ${currentLot?.status ? formatStatusLabel(currentLot.status) : "unknown"} to ${formatStatusLabel(validatedStatus)}`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      // Don't fail the update if audit logging fails
      logger.warn("Failed to log audit entry for status change", auditError, undefined, {
        lotId: validatedLotId,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Lot status updated to ${validatedStatus}`,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "update_lot_status",
      metadata: { lotId: validatedLotId },
    });
  }
}

