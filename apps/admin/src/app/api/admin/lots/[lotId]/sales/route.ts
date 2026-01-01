import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
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
      console.error("Error fetching sales items:", itemsError);
      return NextResponse.json(
        { error: itemsError.message || "Failed to fetch sales items" },
        { status: 500 }
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
      console.error("Error fetching sales orders:", ordersError);
      return NextResponse.json(
        { error: ordersError.message || "Failed to fetch sales orders" },
        { status: 500 }
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
    console.error("Error in sales items API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

