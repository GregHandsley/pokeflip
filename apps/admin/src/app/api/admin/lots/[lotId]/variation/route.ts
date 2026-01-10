import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, enumValue, optional, string } from "@/lib/validation";

const ALLOWED_VARIATIONS = [
  "standard",
  "holo",
  "reverse_holo",
  "first_edition",
  "master_ball",
  "stamped",
  "promo",
  "shadowless",
  "non_holo",
] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    // Validate route parameters
    const { lotId } = await params;
    const validatedLotId = uuid(lotId, "lotId");
    
    // Validate request body
    const body = await req.json();
    const variationInput = optional(body.variation, string, "variation") || "standard";
    const validatedVariation = enumValue(variationInput, ALLOWED_VARIATIONS, "variation");

    const supabase = supabaseServer();
    const { error } = await supabase
      .from("inventory_lots")
      .update({ variation: validatedVariation })
      .eq("id", validatedLotId);

    if (error) {
      logger.error("Failed to update variation", error, undefined, {
        lotId: validatedLotId,
        variation: validatedVariation,
      });
      return createErrorResponse(
        error.message || "Failed to update variation",
        500,
        "UPDATE_VARIATION_FAILED",
        error
      );
    }

    return NextResponse.json({ ok: true, variation: validatedVariation });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    const { lotId } = await params;
    return handleApiError(req, error, {
      operation: "update_variation",
      metadata: { lotId },
    });
  }
}


