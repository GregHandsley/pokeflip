import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { dealId } = await params;
    const body = await req.json();
    const {
      name,
      description,
      deal_type,
      discount_percent,
      discount_amount_pence,
      buy_quantity,
      get_quantity,
      min_card_count,
      max_card_count,
      is_active,
    } = body;

    const supabase = supabaseServer();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (deal_type !== undefined) updateData.deal_type = deal_type;
    if (discount_percent !== undefined) updateData.discount_percent = discount_percent ? parseFloat(discount_percent) : null;
    if (discount_amount_pence !== undefined) updateData.discount_amount_pence = discount_amount_pence ? parseInt(discount_amount_pence, 10) : null;
    if (buy_quantity !== undefined) updateData.buy_quantity = buy_quantity ? parseInt(buy_quantity, 10) : null;
    if (get_quantity !== undefined) updateData.get_quantity = get_quantity ? parseInt(get_quantity, 10) : null;
    if (min_card_count !== undefined) updateData.min_card_count = min_card_count ? parseInt(min_card_count, 10) : 1;
    if (max_card_count !== undefined) updateData.max_card_count = max_card_count ? parseInt(max_card_count, 10) : null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: deal, error } = await supabase
      .from("promotional_deals")
      .update(updateData)
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update promotional deal", error, undefined, { dealId, name, deal_type });
      return createErrorResponse(
        error.message || "Failed to update promotional deal",
        500,
        "UPDATE_PROMOTIONAL_DEAL_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      deal,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "update_promotional_deal", metadata: { dealId } });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { dealId } = await params;
    const supabase = supabaseServer();

    const { error } = await supabase
      .from("promotional_deals")
      .delete()
      .eq("id", dealId);

    if (error) {
      logger.error("Failed to delete promotional deal", error, undefined, { dealId });
      return createErrorResponse(
        error.message || "Failed to delete promotional deal",
        500,
        "DELETE_PROMOTIONAL_DEAL_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "delete_promotional_deal", metadata: { dealId } });
  }
}


