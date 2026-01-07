import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const consumableId = searchParams.get("consumable_id");

    let query = supabase
      .from("consumable_purchases")
      .select(
        `
        *,
        consumables (
          id,
          name,
          unit
        )
      `
      )
      .order("purchased_at", { ascending: false });

    if (consumableId) {
      query = query.eq("consumable_id", consumableId);
    }

    const { data: purchases, error } = await query;

    if (error) {
      logger.error("Failed to fetch consumable purchases", error, undefined, { consumableId });
      return createErrorResponse(
        error.message || "Failed to fetch purchases",
        500,
        "FETCH_CONSUMABLE_PURCHASES_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      purchases: purchases || [],
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_consumable_purchases" });
  }
}

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const body = await req.json();
    const { consumable_id, qty, total_cost_pence, purchased_at } = body;

    if (!consumable_id || !qty || total_cost_pence === undefined) {
      return NextResponse.json(
        { error: "consumable_id, qty, and total_cost_pence are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: purchase, error } = await supabase
      .from("consumable_purchases")
      .insert({
        consumable_id,
        qty: parseInt(qty, 10),
        total_cost_pence: Math.round(total_cost_pence),
        purchased_at: purchased_at || new Date().toISOString(),
      })
      .select(
        `
        *,
        consumables (
          id,
          name,
          unit
        )
      `
      )
      .single();

    if (error) {
      logger.error("Failed to create consumable purchase", error, undefined, {
        consumable_id,
        qty,
        total_cost_pence,
      });
      return createErrorResponse(
        error.message || "Failed to create purchase",
        500,
        "CREATE_CONSUMABLE_PURCHASE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      purchase,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "create_consumable_purchase" });
  }
}


