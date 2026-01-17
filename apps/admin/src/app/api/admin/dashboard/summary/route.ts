import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

type InventoryLotRow = {
  id: string;
  status: string;
  for_sale: boolean;
  list_price_pence: number | null;
  quantity: number;
  use_api_image: boolean;
};

type InventoryStatsRow = {
  status: string;
  for_sale: boolean;
};

type PhotoRow = {
  lot_id: string;
};

type SalesOrderRow = {
  id: string;
};

type SalesOrderProfitRow = {
  revenue_after_discount_pence: number | null;
  sales_order_id?: string;
};

type SalesConsumableRow = {
  consumable_id: string;
  qty: number;
  sales_order_id: string;
  consumables?: {
    id: string;
    name: string;
    unit: string;
  } | null;
};

type ConsumableCostRow = {
  consumable_id: string;
  avg_cost_pence_per_unit: number | null;
};

type ConsumableThresholdRow = {
  id: string;
  low_stock_threshold: number | null;
};

type ConsumableCostViewRow = {
  consumable_id: string;
  total_purchased_qty: number | null;
  total_used_qty?: number | null;
  in_stock_qty?: number | null;
  low_stock_threshold?: number | null;
};

type AcquisitionRow = {
  id: string;
  purchase_total_pence: number | null;
};

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Get inbox summary (ready to list items)
    const { data: inboxLots } = await supabase
      .from("inventory_lots")
      .select(
        `
        id,
        status,
        for_sale,
        list_price_pence,
        quantity,
        use_api_image
      `
      )
      .in("status", ["draft", "ready"]);

    // Get photo counts for these lots
    const lotIds = (inboxLots || []).map((lot: InventoryLotRow) => lot.id);
    const photoCountsMap = new Map<string, number>();

    if (lotIds.length > 0) {
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("lot_id")
        .in("lot_id", lotIds);

      (photos || []).forEach((photo: PhotoRow) => {
        const current = photoCountsMap.get(photo.lot_id) || 0;
        photoCountsMap.set(photo.lot_id, current + 1);
      });
    }

    // Count items by status
    const readyToList = (inboxLots || []).filter(
      (lot: InventoryLotRow) => lot.status === "ready" && lot.for_sale
    ).length;

    const needsPhotos = (inboxLots || []).filter((lot: InventoryLotRow) => {
      const photoCount = photoCountsMap.get(lot.id) || 0;
      const hasPhotos = lot.use_api_image || photoCount >= 2;
      return !hasPhotos && lot.for_sale;
    }).length;

    const highValueReady = (inboxLots || []).filter((lot: InventoryLotRow) => {
      const photoCount = photoCountsMap.get(lot.id) || 0;
      const hasPhotos = lot.use_api_image || photoCount >= 2;
      return (
        lot.status === "ready" &&
        lot.for_sale &&
        hasPhotos &&
        lot.list_price_pence &&
        lot.list_price_pence >= 2000
      ); // £20+
    }).length;

    // Get open purchases count
    const { data: openPurchases } = await supabase
      .from("acquisitions")
      .select("id")
      .eq("status", "open");

    // Get inventory counts
    const { data: inventoryStats } = await supabase
      .from("inventory_lots")
      .select("status, for_sale");

    const totalInventory = (inventoryStats || []).filter(
      (lot: InventoryStatsRow) => lot.status !== "sold" && lot.status !== "archived"
    ).length;

    const listedCount = (inventoryStats || []).filter(
      (lot: InventoryStatsRow) => lot.status === "listed"
    ).length;

    // Get all purchases for profit calculation
    const { data: acquisitions } = await supabase
      .from("acquisitions")
      .select("id, purchase_total_pence");

    // Get all sales orders
    const { data: salesOrders } = await supabase.from("sales_orders").select("id");

    const salesOrderIds = (salesOrders || []).map((o: SalesOrderRow) => o.id);

    // Get recent sales (last 7 days) - use profit view to account for discounts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentSalesProfit } = await supabase
      .from("v_sales_order_profit")
      .select("revenue_after_discount_pence, sales_order_id")
      .gte("sold_at", sevenDaysAgo.toISOString())
      .order("sold_at", { ascending: false })
      .limit(10);

    const recentSalesRevenue = (recentSalesProfit || []).reduce(
      (sum: number, p: SalesOrderProfitRow) => sum + (p.revenue_after_discount_pence || 0),
      0
    );

    const recentSalesCount = recentSalesProfit?.length || 0;

    // Get overall profit data - use profit view to account for discounts
    const total_purchase_cost_pence = (acquisitions || []).reduce(
      (sum, acq: AcquisitionRow) => sum + (acq.purchase_total_pence || 0),
      0
    );

    // Get all profit data to calculate total revenue (after discounts)
    const { data: allProfitData } = await supabase
      .from("v_sales_order_profit")
      .select("revenue_after_discount_pence");

    const total_revenue_pence = (allProfitData || []).reduce(
      (sum, p: SalesOrderProfitRow) => sum + (p.revenue_after_discount_pence || 0),
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
        ...new Set((salesConsumables || []).map((c: SalesConsumableRow) => c.consumable_id)),
      ];

      if (consumableIds.length > 0) {
        const { data: consumableCosts } = await supabase
          .from("v_consumable_costs")
          .select("*")
          .in("consumable_id", consumableIds);

        total_consumables_cost_pence = (salesConsumables || []).reduce(
          (sum, sc: SalesConsumableRow) => {
            const cost = (consumableCosts || []).find(
              (c: ConsumableCostRow) => c.consumable_id === sc.consumable_id
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

    // Consumables stock snapshot (low / out of stock)
    const { data: consumableRows } = await supabase.from("v_consumable_costs").select("*");
    const { data: scRows } = await supabase.from("sales_consumables").select("consumable_id, qty");
    const usedMap = new Map<string, number>();
    (scRows || []).forEach((row: { consumable_id: string; qty: number }) => {
      usedMap.set(row.consumable_id, (usedMap.get(row.consumable_id) || 0) + (row.qty || 0));
    });
    const thresholdMap = new Map<string, number>();
    const thresholdRes = await supabase.from("consumables").select("id, low_stock_threshold");
    if (!thresholdRes.error && thresholdRes.data) {
      thresholdRes.data.forEach((row: ConsumableThresholdRow) => {
        thresholdMap.set(String(row.id), Number(row.low_stock_threshold ?? 0));
      });
    }
    const computedConsumables = (consumableRows || []).map((c: ConsumableCostViewRow) => {
      const purchased = Number(c.total_purchased_qty || 0);
      const used =
        c.total_used_qty != null
          ? Number(c.total_used_qty || 0)
          : usedMap.get(String(c.consumable_id)) || 0;
      const inStock = c.in_stock_qty != null ? Number(c.in_stock_qty || 0) : purchased - used;
      const threshold =
        c.low_stock_threshold != null
          ? Number(c.low_stock_threshold ?? 0)
          : Number(thresholdMap.get(String(c.consumable_id)) ?? 0);
      return { inStock, threshold };
    });
    const outOfStockCount = computedConsumables.filter((c) => c.inStock <= 0).length;
    const lowStockCount = computedConsumables.filter(
      (c) => c.inStock > 0 && c.threshold > 0 && c.inStock <= c.threshold
    ).length;

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
      consumables: {
        lowStockCount,
        outOfStockCount,
      },
      overallProfit,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_dashboard_summary" });
  }
}
