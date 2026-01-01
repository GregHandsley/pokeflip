import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type SalesItemRow = {
  id: string;
  qty: number;
  sold_price_pence: number;
  sales_order_id: string;
  sales_orders?: { id: string; sold_at: string | null } | null;
  inventory_lots?: { card_id: string; condition: string | null } | null;
};

const dateKey = (date: string | null | undefined) => {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const supabase = supabaseServer();
    let resolvedCardId = cardId; // cards.id is text (API id), not necessarily UUID

    const fetchLotsForCard = async (cid: string) =>
      supabase.from("inventory_lots").select("id, condition").eq("card_id", cid);

    // Fetch lot ids for this card
    let { data: lots, error: lotError } = await fetchLotsForCard(resolvedCardId);

    if (lotError) {
      console.error("Error loading lots for card analytics:", lotError);
      return NextResponse.json(
        { error: lotError.message || "Failed to load card analytics" },
        { status: 500 }
      );
    }

    // Fallback: if no lots, try to resolve by card.number (e.g., incoming id is the API id or number)
    if (!lots || lots.length === 0) {
      const numberCandidate = cardId.includes("-")
        ? cardId.split("-").pop() || cardId
        : cardId;
      const { data: cardRow, error: cardError } = await supabase
        .from("cards")
        .select("id")
        .eq("number", numberCandidate)
        .limit(1)
        .single();

      if (cardError) {
        console.error("Fallback card lookup error:", cardError);
      }

      if (cardRow?.id) {
        resolvedCardId = cardRow.id;
        const lotsRetry = await fetchLotsForCard(resolvedCardId);
        lots = lotsRetry.data || [];
        lotError = lotsRetry.error;
        if (lotError) {
          console.error("Error loading lots (fallback) for card analytics:", lotError);
          return NextResponse.json(
            { error: lotError.message || "Failed to load card analytics" },
            { status: 500 }
          );
        }
      }
    }

    const lotIds = (lots || []).map((l) => l.id);
    if (!lotIds || lotIds.length === 0) {
      return NextResponse.json({
        ok: true,
        priceHistory: [],
        avgPriceByCondition: [],
        qtySoldOverTime: [],
        avgMarginPercent: 0,
      });
    }

    // Fetch sales items for these lots
    const { data: salesItems, error: salesError } = await supabase
      .from("sales_items")
      .select(
        `
        id,
        qty,
        sold_price_pence,
        sales_order_id,
        sales_orders!inner(id,sold_at),
        lot_id
      `
      )
      .in("lot_id", lotIds)
      .order("sold_at", { ascending: true, referencedTable: "sales_orders" });

    if (salesError) {
      console.error("Error loading sales items:", salesError);
      return NextResponse.json(
        { error: salesError.message || "Failed to load card analytics" },
        { status: 500 }
      );
    }

    type LotLite = { id: string; condition: string | null };
    const lotConditionMap = new Map<string, string | null>(
      ((lots || []) as LotLite[]).map((l) => [l.id, l.condition || null])
    );

    const items = (salesItems || []) as SalesItemRow[];
    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        priceHistory: [],
        avgPriceByCondition: [],
        qtySoldOverTime: [],
        avgMarginPercent: 0,
      });
    }

    // Build order id list for profit lookup
    const orderIds = Array.from(new Set(items.map((i) => i.sales_order_id)));

    const { data: profits, error: profitError } = await supabase
      .from("v_sales_order_profit")
      .select("sales_order_id, revenue_pence, net_profit_pence")
      .in("sales_order_id", orderIds);

    if (profitError) {
      console.error("Error loading order profits:", profitError);
    }

    const profitMap = new Map(
      (profits || []).map((p) => [p.sales_order_id, p])
    );

    const priceByDate = new Map<string, { revenue: number; qty: number }>();
    const priceByCondition = new Map<string, { revenue: number; qty: number }>();
    let revenueSum = 0;
    let profitSum = 0;

    for (const item of items) {
      const date = dateKey(item.sales_orders?.sold_at) || "";
      const qty = item.qty || 0;
      const revenue = (item.sold_price_pence || 0) * qty;
      const condition = lotConditionMap.get(item.lot_id) || "Unknown";

      // Per-date aggregates
      if (!priceByDate.has(date)) priceByDate.set(date, { revenue: 0, qty: 0 });
      const byDate = priceByDate.get(date)!;
      byDate.revenue += revenue;
      byDate.qty += qty;

      // Condition aggregates
      if (!priceByCondition.has(condition))
        priceByCondition.set(condition, { revenue: 0, qty: 0 });
      const byCond = priceByCondition.get(condition)!;
      byCond.revenue += revenue;
      byCond.qty += qty;

      revenueSum += revenue;

      // Allocate order-level profit to this item by revenue share
      const orderProfit = profitMap.get(item.sales_order_id);
      const orderRevenue = orderProfit?.revenue_pence ?? 0;
      const orderNetProfit = orderProfit?.net_profit_pence ?? 0;
      if (orderRevenue > 0) {
        profitSum += (orderNetProfit * revenue) / orderRevenue;
      }
    }

    const priceHistory = Array.from(priceByDate.entries())
      .map(([date, v]) => ({
        date,
        avg_price_pence: v.qty > 0 ? Math.round(v.revenue / v.qty) : 0,
        qty: v.qty,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const avgPriceByCondition = Array.from(priceByCondition.entries()).map(
      ([condition, v]) => ({
        condition,
        avg_price_pence: v.qty > 0 ? Math.round(v.revenue / v.qty) : 0,
        qty: v.qty,
      })
    );

    const qtySoldOverTime = priceHistory.map((p) => ({
      date: p.date,
      qty: p.qty,
    }));

    const avgMarginPercent =
      revenueSum > 0 ? (profitSum / revenueSum) * 100 : 0;

    return NextResponse.json({
      ok: true,
      priceHistory,
      avgPriceByCondition,
      qtySoldOverTime,
      avgMarginPercent,
    });
  } catch (error: unknown) {
    console.error("Card analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

