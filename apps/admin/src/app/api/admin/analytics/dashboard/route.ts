import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type LotRow = {
  id: string;
  created_at: string;
  status: string;
  quantity: number;
  card_id: string;
};

type SalesItemRow = {
  qty: number;
  lot_id: string;
  sales_orders?: { sold_at: string | null } | null;
};

type ProfitRow = {
  sales_order_id: string;
  revenue_after_discount_pence: number | null;
  revenue_pence: number | null;
  net_profit_pence: number | null;
  sold_at: string | null;
};

const dateKey = (date: string | null | undefined) => {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
};

const sumByDate = (dates: string[], rangeDays: number): { date: string; value: number }[] => {
  const start = new Date();
  start.setDate(start.getDate() - (rangeDays - 1));
  const counts = new Map<string, number>();
  for (const d of dates) {
    if (!d) continue;
    const key = dateKey(d);
    const dt = new Date(key);
    if (dt >= start) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const rangeDays = 90; // default lookback
    const supabase = supabaseServer();

    const [lotsRes, salesItemsRes, profitRes, cardsRes, setsRes] = await Promise.all([
      supabase.from("inventory_lots").select("id, created_at, status, quantity, card_id"),
      supabase.from("sales_items").select("qty, lot_id, sales_orders!inner(sold_at)"),
      supabase
        .from("v_sales_order_profit")
        .select(
          "sales_order_id, revenue_after_discount_pence, revenue_pence, net_profit_pence, sold_at"
        ),
      supabase.from("cards").select("id, set_id"),
      supabase.from("sets").select("id, name"),
    ]);

    if (lotsRes.error || salesItemsRes.error || profitRes.error) {
      logger.error("Failed to load dashboard analytics", undefined, undefined, {
        lotsError: lotsRes.error,
        salesError: salesItemsRes.error,
        profitError: profitRes.error,
      });
      return createErrorResponse(
        "Failed to load dashboard analytics",
        500,
        "DASHBOARD_LOAD_FAILED",
        lotsRes.error || salesItemsRes.error || profitRes.error
      );
    }

    const lots = (lotsRes.data || []) as LotRow[];
    const salesItems = (salesItemsRes.data || []) as unknown as SalesItemRow[];
    const profits = (profitRes.data || []) as ProfitRow[];
    const cardSetMap = new Map<string, string | null>(
      (cardsRes.data || []).map((c) => [c.id, c.set_id || null])
    );
    const setNameMap = new Map<string, string>((setsRes.data || []).map((s) => [s.id, s.name]));

    // Items added / listed / sold
    const itemsAdded = sumByDate(
      lots.map((l) => l.created_at),
      rangeDays
    );
    const itemsListed = sumByDate(
      lots.filter((l) => l.status === "listed").map((l) => l.created_at),
      rangeDays
    );
    const itemsSold = sumByDate(
      salesItems.map((s) => s.sales_orders?.sold_at || ""),
      rangeDays
    ).map((d) => ({ date: d.date, value: d.value })); // value = count of sale records

    // Sell-through by set
    const soldQtyByLot = new Map<string, number>();
    salesItems.forEach((s) => {
      soldQtyByLot.set(s.lot_id, (soldQtyByLot.get(s.lot_id) || 0) + (s.qty || 0));
    });

    const setTotals = new Map<string, { sold: number; total: number; setName: string }>();

    for (const lot of lots) {
      const setId = cardSetMap.get(lot.card_id || "") || "unknown";
      const setName = setNameMap.get(setId || "") || "Unknown Set";
      const entry = setTotals.get(setId) || { sold: 0, total: 0, setName };
      entry.total += lot.quantity || 0;
      entry.sold += soldQtyByLot.get(lot.id) || 0;
      setTotals.set(setId, entry);
    }

    const sellThroughBySet = Array.from(setTotals.entries())
      .map(([setId, v]) => ({
        set_id: setId,
        set_name: v.setName,
        sold: v.sold,
        total: v.total,
        sell_through_rate: v.total > 0 ? v.sold / v.total : 0,
      }))
      .sort((a, b) => b.sell_through_rate - a.sell_through_rate)
      .slice(0, 10); // top sets

    // Profit trend (group by day)
    const profitTrendMap = new Map<string, { revenue: number; profit: number }>();
    profits.forEach((p: ProfitRow) => {
      const key = dateKey(p.sold_at);
      if (!profitTrendMap.has(key)) profitTrendMap.set(key, { revenue: 0, profit: 0 });
      const entry = profitTrendMap.get(key)!;
      // Use revenue_after_discount_pence if available, fallback to revenue_pence
      entry.revenue += (p.revenue_after_discount_pence ?? p.revenue_pence) || 0;
      entry.profit += p.net_profit_pence || 0;
    });

    const profitTrend = Array.from(profitTrendMap.entries())
      .map(([date, v]) => ({
        date,
        revenue_pence: v.revenue,
        net_profit_pence: v.profit,
        margin_percent: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      ok: true,
      period: `last_${rangeDays}_days`,
      itemsAdded,
      itemsListed,
      itemsSold,
      sellThroughBySet,
      profitTrend,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_dashboard_analytics" });
  }
}
