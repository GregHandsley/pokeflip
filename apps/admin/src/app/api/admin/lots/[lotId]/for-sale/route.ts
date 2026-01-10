import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, boolean, optional, pricePence, required } from "@/lib/validation";

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

