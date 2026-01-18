export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, sanitizedNonEmptyString, optional, nonNegative, number } from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ consumableId: string }> }
) {
  const logger = createApiLogger(req);

  // Extract consumableId outside try block so it's available in catch
  const { consumableId } = await params;

  try {
    // Validate route parameters
    const validatedConsumableId = uuid(consumableId, "consumableId");

    // Validate and sanitize request body
    const body = await req.json();
    const validatedName = optional(body.name, (v) => sanitizedNonEmptyString(v, "name"), "name");
    const validatedUnit = optional(body.unit, (v) => sanitizedNonEmptyString(v, "unit"), "unit");
    const validatedLowStockThreshold = optional(
      body.low_stock_threshold,
      (v) => nonNegative(number(v, "low_stock_threshold"), "low_stock_threshold"),
      "low_stock_threshold"
    );

    // At least one field must be provided
    if (!validatedName && !validatedUnit && validatedLowStockThreshold == null) {
      return createErrorResponse(
        "At least one field (name, unit, or low_stock_threshold) must be provided for update",
        400,
        "NO_UPDATE_FIELDS"
      );
    }

    const supabase = supabaseServer();

    const updateData: {
      name?: string;
      unit?: string;
      low_stock_threshold?: number;
    } = {};
    if (validatedName) updateData.name = validatedName; // Already sanitized
    if (validatedUnit) updateData.unit = validatedUnit; // Already sanitized
    if (validatedLowStockThreshold != null)
      updateData.low_stock_threshold = validatedLowStockThreshold;

    const { data: consumable, error } = await supabase
      .from("consumables")
      .update(updateData)
      .eq("id", validatedConsumableId)
      .select("*")
      .single();

    if (error) {
      logger.error("Failed to update consumable", error, undefined, {
        consumableId: validatedConsumableId,
        name: validatedName,
        unit: validatedUnit,
      });
      return createErrorResponse(
        error.message || "Failed to update consumable",
        500,
        "UPDATE_CONSUMABLE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      consumable,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "update_consumable",
      metadata: { consumableId },
    });
  }
}
