import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { for_sale, list_price_pence } = body;

    if (for_sale === undefined) {
      return NextResponse.json(
        { error: "for_sale is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Prepare update object
    const updateData: { 
      for_sale: boolean; 
      list_price_pence?: number | null;
    } = {
      for_sale,
    };

    // If marking as for sale and no price provided, set a default or keep existing
    if (for_sale && list_price_pence !== undefined) {
      updateData.list_price_pence = list_price_pence != null ? Math.round(list_price_pence * 100) : null;
    } else if (!for_sale) {
      // If marking as not for sale, optionally clear the price
      // For now, keep the price but you can clear it if needed
    }

    // Update the lot
    const { error } = await supabase
      .from("inventory_lots")
      .update(updateData)
      .eq("id", lotId);

    if (error) {
      logger.error("Failed to update lot for_sale status", error, undefined, {
        lotId,
        for_sale,
        list_price_pence,
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
      message: `Lot marked as ${for_sale ? "for sale" : "not for sale"}`,
    });
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "update_for_sale",
      metadata: { lotId, body },
    });
  }
}

