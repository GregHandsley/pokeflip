import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    // Fetch sales items
    const { data: salesItems, error: itemsError } = await supabase
      .from("sales_items")
      .select("id, qty, sold_price_pence, created_at, sales_order_id")
      .eq("lot_id", lotId)
      .order("created_at", { ascending: false });

    if (itemsError) {
      logger.error("Failed to fetch sales items", itemsError, undefined, { lotId });
      return createErrorResponse(
        itemsError.message || "Failed to fetch sales items",
        500,
        "FETCH_SALES_ITEMS_FAILED",
        itemsError
      );
    }

    if (!salesItems || salesItems.length === 0) {
      return NextResponse.json({
        ok: true,
        sales_items: [],
      });
    }

    // Fetch sales orders for these items
    const orderIds = [...new Set(salesItems.map((item: any) => item.sales_order_id))];
    const { data: salesOrders, error: ordersError } = await supabase
      .from("sales_orders")
      .select("id, sold_at, order_group, platform, platform_order_ref, buyer_id")
      .in("id", orderIds);

    if (ordersError) {
      logger.error("Failed to fetch sales orders", ordersError, undefined, {
        lotId,
        orderIdsCount: orderIds.length,
      });
      return createErrorResponse(
        ordersError.message || "Failed to fetch sales orders",
        500,
        "FETCH_SALES_ORDERS_FAILED",
        ordersError
      );
    }

    // Fetch buyers if needed
    const buyerIds = [...new Set((salesOrders || []).map((order: any) => order.buyer_id).filter(Boolean))];
    let buyersMap = new Map();
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase
        .from("buyers")
        .select("id, handle, platform")
        .in("id", buyerIds);

      (buyers || []).forEach((buyer: any) => {
        buyersMap.set(buyer.id, buyer);
      });
    }

    // Create orders map
    const ordersMap = new Map();
    (salesOrders || []).forEach((order: any) => {
      ordersMap.set(order.id, order);
    });

    // Format the response
    const formattedItems = salesItems.map((item: any) => {
      const order = ordersMap.get(item.sales_order_id);
      const buyer = order?.buyer_id ? buyersMap.get(order.buyer_id) : null;
      
      return {
        id: item.id,
        qty: item.qty,
        sold_price_pence: item.sold_price_pence,
        sold_at: order?.sold_at || item.created_at,
        order_group: order?.order_group || null,
        platform: order?.platform || "ebay",
        platform_order_ref: order?.platform_order_ref || null,
        buyer_handle: buyer?.handle || null,
        created_at: item.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      sales_items: formattedItems,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_lot_sales", metadata: { lotId } });
  }
}

