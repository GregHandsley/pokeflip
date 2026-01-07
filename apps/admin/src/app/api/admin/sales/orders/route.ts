import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();

    // Get all sales orders with buyer and items
    const { data: orders, error } = await supabase
      .from("sales_orders")
      .select(
        `
        id,
        sold_at,
        buyers (
          handle
        ),
        sales_items (
          qty,
          sold_price_pence,
          inventory_lots (
            cards (
              name,
              number
            )
          )
        )
      `
      )
      .order("sold_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch sales orders", error);
      return createErrorResponse(
        error.message || "Failed to fetch sales orders",
        500,
        "FETCH_SALES_ORDERS_FAILED",
        error
      );
    }

    // Format the response
    const formattedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      sold_at: order.sold_at,
      buyer: order.buyers ? { handle: order.buyers.handle } : null,
      sales_items: (order.sales_items || []).map((item: any) => ({
        qty: item.qty,
        sold_price_pence: item.sold_price_pence,
        lot: item.inventory_lots ? {
          card: item.inventory_lots.cards ? {
            name: item.inventory_lots.cards.name,
            number: item.inventory_lots.cards.number,
          } : null,
        } : null,
      })),
    }));

    return NextResponse.json({
      ok: true,
      orders: formattedOrders,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_sales_orders" });
  }
}


