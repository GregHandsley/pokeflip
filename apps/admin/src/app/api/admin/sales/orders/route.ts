export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type CardRow = {
  name: string;
  number: string;
};

type InventoryLotRow = {
  cards: CardRow[] | null;
};

type SalesItemRow = {
  qty: number;
  sold_price_pence: number;
  inventory_lots: InventoryLotRow[] | null;
};

type BuyerRow = {
  handle: string;
};

type SalesOrderRow = {
  id: string;
  sold_at: string;
  buyers: BuyerRow[] | null;
  sales_items: SalesItemRow[] | null;
};

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
    const formattedOrders = (orders || []).map((order: SalesOrderRow) => ({
      id: order.id,
      sold_at: order.sold_at,
      buyer: order.buyers && order.buyers.length > 0 ? { handle: order.buyers[0].handle } : null,
      sales_items: (order.sales_items || []).map((item: SalesItemRow) => ({
        qty: item.qty,
        sold_price_pence: item.sold_price_pence,
        lot:
          item.inventory_lots &&
          item.inventory_lots.length > 0 &&
          item.inventory_lots[0].cards &&
          item.inventory_lots[0].cards.length > 0
            ? {
                card: {
                  name: item.inventory_lots[0].cards[0].name,
                  number: item.inventory_lots[0].cards[0].number,
                },
              }
            : null,
      })),
    }));

    return NextResponse.json({
      ok: true,
      orders: formattedOrders,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_sales_orders" });
  }
}
