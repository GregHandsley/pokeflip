import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let query = supabase
      .from("buyers")
      .select(
        `
        id,
        handle,
        platform,
        sales_orders (
          id
        )
      `
      )
      .order("handle", { ascending: true });

    if (search) {
      query = query.ilike("handle", `%${search}%`);
    }

    const { data: buyers, error } = await query;

    if (error) {
      logger.error("Failed to fetch buyers", error);
      return createErrorResponse(
        error.message || "Failed to fetch buyers",
        500,
        "FETCH_BUYERS_FAILED",
        error
      );
    }

    // Calculate stats for each buyer using a more efficient query
    const buyerIds = (buyers || []).map((b: any) => b.id);
    
    // Get all orders for these buyers
    const { data: allOrders } = await supabase
      .from("sales_orders")
      .select("id, buyer_id")
      .in("buyer_id", buyerIds);

    const orderCounts = new Map<string, number>();
    (allOrders || []).forEach((order: any) => {
      const count = orderCounts.get(order.buyer_id) || 0;
      orderCounts.set(order.buyer_id, count + 1);
    });

    // Get all sales items for these orders
    const orderIds = (allOrders || []).map((o: any) => o.id);
    const { data: allItems } = orderIds.length > 0 ? await supabase
      .from("sales_items")
      .select("sales_order_id, sold_price_pence, qty")
      .in("sales_order_id", orderIds) : { data: [] };

    // Map order_id to buyer_id
    const orderToBuyer = new Map<string, string>();
    (allOrders || []).forEach((order: any) => {
      orderToBuyer.set(order.id, order.buyer_id);
    });

    // Calculate total spend per buyer
    const totalSpend = new Map<string, number>();
    (allItems || []).forEach((item: any) => {
      const buyerId = orderToBuyer.get(item.sales_order_id);
      if (buyerId) {
        const current = totalSpend.get(buyerId) || 0;
        totalSpend.set(buyerId, current + (item.sold_price_pence || 0) * (item.qty || 0));
      }
    });

    const buyersWithStats = (buyers || []).map((buyer: any) => ({
      id: buyer.id,
      handle: buyer.handle,
      platform: buyer.platform,
      order_count: orderCounts.get(buyer.id) || 0,
      total_spend_pence: totalSpend.get(buyer.id) || 0,
    }));

    return NextResponse.json({
      ok: true,
      buyers: buyersWithStats,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "fetch_buyers" });
  }
}

