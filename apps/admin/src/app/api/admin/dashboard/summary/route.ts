import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();

    // Get inbox summary (ready to list items)
    const { data: inboxLots, error: inboxError } = await supabase
      .from("inventory_lots")
      .select(`
        id,
        status,
        for_sale,
        list_price_pence,
        quantity,
        use_api_image
      `)
      .in("status", ["draft", "ready"]);

    // Get photo counts for these lots
    const lotIds = (inboxLots || []).map((lot: any) => lot.id);
    const photoCountsMap = new Map<string, number>();
    
    if (lotIds.length > 0) {
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("lot_id")
        .in("lot_id", lotIds);
      
      (photos || []).forEach((photo: any) => {
        const current = photoCountsMap.get(photo.lot_id) || 0;
        photoCountsMap.set(photo.lot_id, current + 1);
      });
    }

    // Count items by status
    const readyToList = (inboxLots || []).filter(
      (lot: any) => lot.status === "ready" && lot.for_sale
    ).length;
    
    const needsPhotos = (inboxLots || []).filter((lot: any) => {
      const photoCount = photoCountsMap.get(lot.id) || 0;
      const hasPhotos = lot.use_api_image || photoCount >= 2;
      return !hasPhotos && lot.for_sale;
    }).length;

    const highValueReady = (inboxLots || []).filter((lot: any) => {
      const photoCount = photoCountsMap.get(lot.id) || 0;
      const hasPhotos = lot.use_api_image || photoCount >= 2;
      return lot.status === "ready" && lot.for_sale && hasPhotos && 
             lot.list_price_pence && lot.list_price_pence >= 2000; // £20+
    }).length;

    // Get open purchases count
    const { data: openPurchases, error: purchasesError } = await supabase
      .from("acquisitions")
      .select("id")
      .eq("status", "open");

    // Get inventory counts
    const { data: inventoryStats, error: inventoryError } = await supabase
      .from("inventory_lots")
      .select("status, for_sale");

    const totalInventory = (inventoryStats || []).filter(
      (lot: any) => lot.status !== "sold" && lot.status !== "archived"
    ).length;

    const listedCount = (inventoryStats || []).filter(
      (lot: any) => lot.status === "listed"
    ).length;

    // Get all purchases for profit calculation
    const { data: acquisitions, error: acqError } = await supabase
      .from("acquisitions")
      .select("id, purchase_total_pence");

    // Get all sales orders
    const { data: salesOrders, error: ordersError } = await supabase
      .from("sales_orders")
      .select("id");

    const salesOrderIds = (salesOrders || []).map((o: any) => o.id);

    // Get recent sales (last 7 days) - use profit view to account for discounts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentSalesProfit, error: salesError } = await supabase
      .from("v_sales_order_profit")
      .select("revenue_after_discount_pence, sales_order_id")
      .gte("sold_at", sevenDaysAgo.toISOString())
      .order("sold_at", { ascending: false })
      .limit(10);

    const recentSalesRevenue = (recentSalesProfit || []).reduce(
      (sum: number, p: any) => sum + (p.revenue_after_discount_pence || 0),
      0
    );

    const recentSalesCount = recentSalesProfit?.length || 0;

    // Get overall profit data - use profit view to account for discounts
    const total_purchase_cost_pence = (acquisitions || []).reduce(
      (sum, acq) => sum + (acq.purchase_total_pence || 0),
      0
    );

    // Get all profit data to calculate total revenue (after discounts)
    const { data: allProfitData } = await supabase
      .from("v_sales_order_profit")
      .select("revenue_after_discount_pence");

    const total_revenue_pence = (allProfitData || []).reduce(
      (sum, p) => sum + (p.revenue_after_discount_pence || 0),
      0
    );

    // Get consumables costs (reuse from earlier query if we have sales orders)
    let total_consumables_cost_pence = 0;
    if (salesOrderIds.length > 0) {
      const { data: salesConsumables } = await supabase
        .from("sales_consumables")
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
        .in("sales_order_id", salesOrderIds);

      const consumableIds = [
        ...new Set(
          (salesConsumables || []).map((c: any) => c.consumable_id)
        ),
      ];

      if (consumableIds.length > 0) {
        const { data: consumableCosts } = await supabase
          .from("v_consumable_costs")
          .select("*")
          .in("consumable_id", consumableIds);

        total_consumables_cost_pence = (salesConsumables || []).reduce(
          (sum, sc: any) => {
            const cost = (consumableCosts || []).find(
              (c) => c.consumable_id === sc.consumable_id
            );
            const unitCost = cost?.avg_cost_pence_per_unit || 0;
            return sum + sc.qty * unitCost;
          },
          0
        );
      }
    }

    const total_costs_pence = total_purchase_cost_pence + total_consumables_cost_pence;
    const net_profit_pence = total_revenue_pence - total_costs_pence;
    const margin_percent =
      total_revenue_pence > 0 ? (net_profit_pence / total_revenue_pence) * 100 : 0;

    const overallProfit = {
      purchase_cost_pence: total_purchase_cost_pence,
      revenue_pence: total_revenue_pence,
      consumables_cost_pence: total_consumables_cost_pence,
      total_costs_pence,
      net_profit_pence,
      margin_percent,
    };

    return NextResponse.json({
      ok: true,
      inbox: {
        readyToList,
        needsPhotos,
        highValueReady,
      },
      purchases: {
        open: openPurchases?.length || 0,
      },
      inventory: {
        total: totalInventory,
        listed: listedCount,
      },
      recentSales: {
        count: recentSalesCount,
        revenue_pence: recentSalesRevenue,
      },
      overallProfit,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_dashboard_summary" });
  }
}

