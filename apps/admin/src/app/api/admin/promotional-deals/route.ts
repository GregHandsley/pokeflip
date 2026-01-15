import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  sanitizedNonEmptyString,
  sanitizedString,
  dealType,
  optional,
  percentage,
  nonNegative,
  integer,
  quantity,
  boolean,
  number,
} from "@/lib/validation";

export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const supabase = supabaseServer();

    let query = supabase.from("promotional_deals").select("*");

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: deals, error } = await query.order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch promotional deals", error);
      return createErrorResponse(
        error.message || "Failed to fetch promotional deals",
        500,
        "FETCH_PROMOTIONAL_DEALS_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      deals: deals || [],
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_promotional_deals" });
  }
}

export async function POST(req: Request) {
  const logger = createApiLogger(req);

  try {
    const body = await req.json();

    // Validate and sanitize required fields
    const validatedName = sanitizedNonEmptyString(body.name, "name");
    const validatedDealType = dealType(body.deal_type, "deal_type");

    // Validate and sanitize optional fields
    const validatedDescription = optional(
      body.description,
      (v) => sanitizedString(v, "description"),
      "description"
    );
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
    const validatedMinCardCount =
      optional(body.min_card_count, (v) => quantity(v, "min_card_count"), "min_card_count") || 1;
    const validatedMaxCardCount = optional(
      body.max_card_count,
      (v) => quantity(v, "max_card_count"),
      "max_card_count"
    );
    const validatedIsActive = optional(body.is_active, boolean, "is_active") ?? true;

    const supabase = supabaseServer();

    const { data: deal, error } = await supabase
      .from("promotional_deals")
      .insert({
        name: validatedName,
        description: validatedDescription || null,
        deal_type: validatedDealType,
        discount_percent: validatedDiscountPercent || null,
        discount_amount_pence: validatedDiscountAmountPence || null,
        buy_quantity: validatedBuyQuantity || null,
        get_quantity: validatedGetQuantity || null,
        min_card_count: validatedMinCardCount,
        max_card_count: validatedMaxCardCount || null,
        is_active: validatedIsActive,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create promotional deal", error, undefined, {
        name: validatedName,
        deal_type: validatedDealType,
      });
      return createErrorResponse(
        error.message || "Failed to create promotional deal",
        500,
        "CREATE_PROMOTIONAL_DEAL_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      deal,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "create_promotional_deal" });
  }
}
