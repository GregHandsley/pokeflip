import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { sanitizedNonEmptyString, optional, number, string } from "@/lib/validation";
import { logAudit, getCurrentUser } from "@/lib/audit";

/**
 * POST /api/admin/acquisitions
 * Create a new acquisition (purchase)
 */
export async function POST(req: Request) {
  const logger = createApiLogger(req);

  try {
    const body = await req.json();

    // Validate required fields
    const validatedSourceName = sanitizedNonEmptyString(body.source_name, "source_name");
    const validatedSourceType = sanitizedNonEmptyString(body.source_type, "source_type");
    const validatedTotalPence = number(body.purchase_total_pence, "purchase_total_pence");
    const validatedPurchasedAt =
      optional(body.purchased_at, string, "purchased_at") || new Date().toISOString();
    const validatedNotes = optional(body.notes, string, "notes");

    // Get current user for audit logging
    const userInfo = await getCurrentUser(req);

    const supabase = supabaseServer();

    // Insert acquisition
    const { data: acquisition, error } = await supabase
      .from("acquisitions")
      .insert({
        source_name: validatedSourceName,
        source_type: validatedSourceType,
        purchase_total_pence: validatedTotalPence,
        purchased_at: validatedPurchasedAt,
        notes: validatedNotes || null,
        status: "open",
      })
      .select("id, source_name, purchase_total_pence, purchased_at")
      .single();

    if (error) {
      logger.error("Failed to create acquisition", error, undefined, {
        source_name: validatedSourceName,
        source_type: validatedSourceType,
      });
      return createErrorResponse(
        error.message || "Failed to create acquisition",
        500,
        "CREATE_ACQUISITION_FAILED",
        error
      );
    }

    // Log audit entry for acquisition creation
    try {
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "create_acquisition",
        entity_type: "acquisition",
        entity_id: acquisition.id,
        old_values: null, // No old state for creation
        new_values: {
          source_name: validatedSourceName,
          source_type: validatedSourceType,
          purchase_total_pence: validatedTotalPence,
          purchased_at: validatedPurchasedAt,
          notes: validatedNotes,
          status: "open",
        },
        description: `Purchase created: ${validatedSourceName}`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      // Don't fail the acquisition if audit logging fails
      logger.warn("Failed to log audit entry for acquisition creation", undefined, {
        acquisitionId: acquisition.id,
        error: auditError,
      });
    }

    return NextResponse.json({
      ok: true,
      acquisition,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "create_acquisition",
    });
  }
}
