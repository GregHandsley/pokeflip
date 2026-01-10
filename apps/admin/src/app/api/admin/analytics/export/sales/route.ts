import { NextResponse } from "next/server";
import { Parser } from "json2csv";
import { penceToPounds } from "@pokeflip/shared";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();

    const [ordersRes, profitRes] = await Promise.all([
      supabase
        .from("sales_orders")
        .select(
          `
          id,
          sold_at,
          platform,
          order_group,
          fees_pence,
          shipping_pence,
          discount_pence,
          bundle_id,
          bundles:bundle_id ( name ),
          buyers:buyer_id ( handle ),
          sales_items (
            qty,
            sold_price_pence,
            lot_id,
            inventory_lots!inner (
              condition,
              variation,
              cards!inner (
                number,
                name,
                sets:set_id ( name )
              )
            )
          )
        `
        )
        .order("sold_at", { ascending: false }),
      supabase
        .from("v_sales_order_profit")
        .select("sales_order_id, revenue_pence, net_profit_pence, margin_percent"),
    ]);

    if (ordersRes.error || profitRes.error) {
      logger.error("Failed to generate sales export", undefined, undefined, {
        ordersError: ordersRes.error,
        profitError: profitRes.error,
      });
      return createErrorResponse(
        "Failed to generate sales export",
        500,
        "SALES_EXPORT_FAILED",
        ordersRes.error || profitRes.error
      );
    }

    const profitMap = new Map(
      (profitRes.data || []).map((p) => [p.sales_order_id, p])
    );

    type OrderRow = {
      id: string;
      sold_at: string;
      platform: string;
      order_group: string | null;
      fees_pence: number | null;
      shipping_pence: number | null;
      discount_pence: number | null;
      bundle_id: string | null;
      bundles?: { name: string | null } | null;
      buyers?: { handle: string | null } | null;
      sales_items: SalesItemRow[] | null;
    };

    type SalesItemRow = {
      qty: number;
      sold_price_pence: number;
      inventory_lots?: {
        condition: string | null;
        variation?: string | null;
        cards?: { number: string | null; name: string | null; sets?: { name: string | null } | null } | null;
      } | null;
    };

    const rows: Array<Record<string, string | number>> = [];

    ((ordersRes.data || []) as OrderRow[]).forEach((order) => {
      const profit = profitMap.get(order.id);
      const orderRevenue = profit?.revenue_pence || 0;
      const orderNetProfit = profit?.net_profit_pence || 0;

      (order.sales_items || []).forEach((item) => {
        const revenue = (item.qty || 0) * (item.sold_price_pence || 0);
        const itemProfit =
          orderRevenue > 0 ? (orderNetProfit * revenue) / orderRevenue : 0;

        rows.push({
          order_id: order.id,
          sold_at: order.sold_at,
          platform: order.platform,
          order_group: order.order_group || "",
          buyer_handle: order.buyers?.handle || "",
          bundle_id: order.bundle_id || "",
          bundle_name: order.bundles?.name || "",
          card_number: item.inventory_lots?.cards?.number || "",
          card_name: item.inventory_lots?.cards?.name || "",
          set_name: item.inventory_lots?.cards?.sets?.name || "",
          condition: item.inventory_lots?.condition || "",
          variation: item.inventory_lots?.variation || "standard",
          qty: item.qty || 0,
          sold_price_each_gbp: penceToPounds(item.sold_price_pence || 0),
          revenue_gbp: penceToPounds(revenue),
          order_fees_gbp: penceToPounds(order.fees_pence || 0),
          order_shipping_gbp: penceToPounds(order.shipping_pence || 0),
          order_discount_gbp: penceToPounds(order.discount_pence || 0),
          order_revenue_gbp: penceToPounds(orderRevenue),
          order_net_profit_gbp: penceToPounds(orderNetProfit),
          order_margin_percent: profit?.margin_percent ?? 0,
          allocated_profit_gbp: penceToPounds(Math.round(itemProfit)),
        });
      });
    });

    const parser = new Parser();
    const csv = parser.parse(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=sales.csv",
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "export_sales" });
  }
}

