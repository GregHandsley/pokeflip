import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  uuid,
  optional,
  sanitizedNonEmptyString,
  sanitizedString,
  dealType,
  percentage,
  nonNegative,
  integer,
  quantity,
  boolean,
  number,
} from "@/lib/validation";

type PromotionalDealUpdateData = {
  name?: string;
  description?: string | null;
  deal_type?: string;
  discount_percent?: number | null;
  discount_amount_pence?: number | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  min_card_count?: number;
  max_card_count?: number | null;
  is_active?: boolean;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const logger = createApiLogger(req);
  const { dealId } = await params;

  try {
    // Validate route parameters
    const validatedDealId = uuid(dealId, "dealId");

    // Validate request body
    const body = await req.json();
    const validatedName = optional(body.name, (v) => sanitizedNonEmptyString(v, "name"), "name");
    const validatedDescription = optional(
      body.description,
      (v) => sanitizedString(v, "description"),
      "description"
    );
    const validatedDealType = optional(body.deal_type, dealType, "deal_type");
    const validatedDiscountPercent = optional(
      body.discount_percent,
      (v) => percentage(number(v, "discount_percent"), "discount_percent"),
      "discount_percent"
    );
    const validatedDiscountAmountPence = optional(
      body.discount_amount_pence,
      (v) => nonNegative(integer(v, "discount_amount_pence"), "discount_amount_pence"),
      "discount_amount_pence"
    );
    const validatedBuyQuantity = optional(
      body.buy_quantity,
      (v) => quantity(v, "buy_quantity"),
      "buy_quantity"
    );
    const validatedGetQuantity = optional(
      body.get_quantity,
      (v) => quantity(v, "get_quantity"),
      "get_quantity"
    );
    const validatedMinCardCount = optional(
      body.min_card_count,
      (v) => quantity(v, "min_card_count"),
      "min_card_count"
    );
    const validatedMaxCardCount = optional(
      body.max_card_count,
      (v) => quantity(v, "max_card_count"),
      "max_card_count"
    );
    const validatedIsActive = optional(body.is_active, boolean, "is_active");

    const supabase = supabaseServer();

    const updateData: PromotionalDealUpdateData = {};
    if (validatedName !== undefined) updateData.name = validatedName;
    if (validatedDescription !== undefined) {
      updateData.description = validatedDescription === "" ? null : validatedDescription;
    }
    if (validatedDealType !== undefined) {
      updateData.deal_type = validatedDealType as string;
    }
    if (validatedDiscountPercent !== undefined)
      updateData.discount_percent = validatedDiscountPercent || null;
    if (validatedDiscountAmountPence !== undefined)
      updateData.discount_amount_pence = validatedDiscountAmountPence || null;
    if (validatedBuyQuantity !== undefined) updateData.buy_quantity = validatedBuyQuantity || null;
    if (validatedGetQuantity !== undefined) updateData.get_quantity = validatedGetQuantity || null;
    if (validatedMinCardCount !== undefined) updateData.min_card_count = validatedMinCardCount || 1;
    if (validatedMaxCardCount !== undefined)
      updateData.max_card_count = validatedMaxCardCount || null;
    if (validatedIsActive !== undefined) {
      updateData.is_active = validatedIsActive as boolean;
    }

    const { data: deal, error } = await supabase
      .from("promotional_deals")
      .update(updateData)
      .eq("id", validatedDealId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update promotional deal", undefined, {
        dealId: validatedDealId,
        name: validatedName,
        deal_type: validatedDealType,
        error,
      });
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
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "update_promotional_deal",
      metadata: { dealId },
    });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const logger = createApiLogger(req);
  const { dealId } = await params;

  try {
    // Validate route parameters
    const validatedDealId = uuid(dealId, "dealId");

    const supabase = supabaseServer();

    const { error } = await supabase.from("promotional_deals").delete().eq("id", validatedDealId);

    if (error) {
      logger.error("Failed to delete promotional deal", undefined, {
        dealId: validatedDealId,
        error,
      });
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
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "delete_promotional_deal",
      metadata: { dealId },
    });
  }
}
