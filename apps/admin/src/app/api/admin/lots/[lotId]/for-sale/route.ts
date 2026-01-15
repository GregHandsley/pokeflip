import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { logAudit, getCurrentUser } from "@/lib/audit";
import { uuid, boolean, optional, pricePence, required } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);

  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);

  // Extract lotId outside try block so it's available in catch
  const { lotId } = await params;

  try {
    // Validate route parameters
    const validatedLotId = uuid(lotId, "lotId");

    // Validate request body
    const body = await req.json();
    const validatedForSale = boolean(required(body.for_sale, "for_sale"), "for_sale");
    const validatedPrice = optional(
      body.list_price_pence,
      (v) => pricePence(v, "list_price_pence"),
      "list_price_pence"
    );

    // Business rule: if for_sale is true and price is provided, it must be positive
    if (validatedForSale && validatedPrice !== undefined) {
      pricePence(validatedPrice, "list_price_pence");
    }

    const supabase = supabaseServer();

    // Get current lot state for audit logging
    const { data: currentLot, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("for_sale, list_price_pence")
      .eq("id", validatedLotId)
      .single();

    if (fetchError) {
      logger.error("Failed to fetch lot for audit", fetchError, undefined, {
        lotId: validatedLotId,
      });
      // Continue anyway - audit logging is best effort
    }

    // Prepare update object
    const updateData: {
      for_sale: boolean;
      list_price_pence?: number | null;
    } = {
      for_sale: validatedForSale,
    };

    // If marking as for sale and price provided, use it
    if (validatedForSale && validatedPrice !== undefined) {
      updateData.list_price_pence = validatedPrice;
    } else if (!validatedForSale) {
      // If marking as not for sale, clear the price
      updateData.list_price_pence = null;
    }

    // Update the lot
    const { error } = await supabase
      .from("inventory_lots")
      .update(updateData)
      .eq("id", validatedLotId);

    if (error) {
      logger.error("Failed to update lot for_sale status", error, undefined, {
        lotId: validatedLotId,
        for_sale: validatedForSale,
        list_price_pence: validatedPrice,
      });
      return createErrorResponse(
        error.message || "Failed to update for_sale status",
        500,
        "UPDATE_FOR_SALE_FAILED",
        error
      );
    }

    // Log audit entry for price change
    try {
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "update_price",
        entity_type: "inventory_lot",
        entity_id: validatedLotId,
        old_values: currentLot
          ? {
              for_sale: currentLot.for_sale,
              list_price_pence: currentLot.list_price_pence,
            }
          : null,
        new_values: {
          for_sale: validatedForSale,
          list_price_pence: validatedPrice || null,
        },
        description: validatedForSale
          ? validatedPrice
            ? `Price set to £${(validatedPrice / 100).toFixed(2)}`
            : `Marked for sale`
          : `Removed from sale`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      // Don't fail the update if audit logging fails
      logger.warn("Failed to log audit entry for price change", undefined, {
        lotId: validatedLotId,
        error: auditError,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Lot marked as ${validatedForSale ? "for sale" : "not for sale"}`,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "update_for_sale",
      metadata: { lotId },
    });
  }
}
