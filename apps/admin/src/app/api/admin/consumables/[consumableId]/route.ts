import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, nonEmptyString, optional, string } from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ consumableId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    // Validate route parameters
    const { consumableId } = await params;
    const validatedConsumableId = uuid(consumableId, "consumableId");
    
    // Validate request body
    const body = await req.json();
    const validatedName = optional(body.name, nonEmptyString, "name");
    const validatedUnit = optional(body.unit, (v) => nonEmptyString(v, "unit"), "unit");
    
    // At least one field must be provided
    if (!validatedName && !validatedUnit) {
      return createErrorResponse(
        "At least one field (name or unit) must be provided for update",
        400,
        "NO_UPDATE_FIELDS"
      );
    }

    const supabase = supabaseServer();

    const updateData: any = {};
    if (validatedName) updateData.name = validatedName.trim();
    if (validatedUnit) updateData.unit = validatedUnit.trim();

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
      metadata: { consumableId: validatedConsumableId },
    });
  }
}


