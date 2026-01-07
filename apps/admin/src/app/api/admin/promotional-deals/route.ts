import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";
    
    const supabase = supabaseServer();

    let query = supabase
      .from("promotional_deals")
      .select("*");
    
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
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_promotional_deals" });
  }
}

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  
  try {
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

    if (!name || !deal_type) {
      return NextResponse.json(
        { error: "Missing required fields: name, deal_type" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: deal, error } = await supabase
      .from("promotional_deals")
      .insert({
        name,
        description,
        deal_type,
        discount_percent: discount_percent ? parseFloat(discount_percent) : null,
        discount_amount_pence: discount_amount_pence ? parseInt(discount_amount_pence, 10) : null,
        buy_quantity: buy_quantity ? parseInt(buy_quantity, 10) : null,
        get_quantity: get_quantity ? parseInt(get_quantity, 10) : null,
        min_card_count: min_card_count ? parseInt(min_card_count, 10) : 1,
        max_card_count: max_card_count ? parseInt(max_card_count, 10) : null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create promotional deal", error, undefined, { name, deal_type });
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
  } catch (error: any) {
    return handleApiError(req, error, { operation: "create_promotional_deal" });
  }
}

