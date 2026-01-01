import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
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
      console.error("Error fetching sales orders:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch sales orders" },
        { status: 500 }
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
    console.error("Error in sales orders API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

