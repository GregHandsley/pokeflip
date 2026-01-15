import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

const dateKey = (date: string | null | undefined) => {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
};

const variationLabel = (v?: string | null) => {
  switch (v) {
    case "holo":
      return "Holo";
    case "reverse_holo":
      return "Reverse Holo";
    case "first_edition":
      return "First Edition";
    case "master_ball":
      return "Master Ball";
    case "stamped":
      return "Stamped";
    case "promo":
      return "Promo";
    case "shadowless":
      return "Shadowless";
    case "non_holo":
      return "Non-Holo";
    default:
      return "Standard";
  }
};

export async function GET(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const logger = createApiLogger(req);
  const { cardId } = await params;

  try {
    const supabase = supabaseServer();
    let resolvedCardId = cardId; // cards.id is text (API id), not necessarily UUID

    const fetchLotsForCard = async (cid: string) =>
      supabase.from("inventory_lots").select("id, condition, variation").eq("card_id", cid);

    // Fetch lot ids for this card
    let { data: lots, error: lotError } = await fetchLotsForCard(resolvedCardId);

    if (lotError) {
      logger.error("Failed to load lots for card analytics", lotError, undefined, { cardId });
      return createErrorResponse(
        lotError.message || "Failed to load card analytics",
        500,
        "LOAD_CARD_ANALYTICS_FAILED",
        lotError
      );
    }

    // Fallback: if no lots, try to resolve by card.number (e.g., incoming id is the API id or number)
    if (!lots || lots.length === 0) {
      const numberCandidate = cardId.includes("-") ? cardId.split("-").pop() || cardId : cardId;
      const { data: cardRow, error: cardError } = await supabase
        .from("cards")
        .select("id")
        .eq("number", numberCandidate)
        .limit(1)
        .single();

      if (cardError) {
        logger.warn("Fallback card lookup failed", undefined, {
          cardId,
          numberCandidate,
          error: cardError,
        });
      }

      if (cardRow?.id) {
        resolvedCardId = cardRow.id;
        const lotsRetry = await fetchLotsForCard(resolvedCardId);
        lots = lotsRetry.data || [];
        lotError = lotsRetry.error;
        if (lotError) {
          logger.error("Failed to load lots (fallback) for card analytics", lotError, undefined, {
            cardId,
            resolvedCardId,
          });
          return createErrorResponse(
            lotError.message || "Failed to load card analytics",
            500,
            "LOAD_CARD_ANALYTICS_FAILED",
            lotError
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
      logger.error("Failed to load sales items for card analytics", salesError, undefined, {
        cardId,
        lotIdsCount: lotIds.length,
      });
      return createErrorResponse(
        salesError.message || "Failed to load card analytics",
        500,
        "LOAD_CARD_ANALYTICS_FAILED",
        salesError
      );
    }

    type LotLite = { id: string; condition: string | null; variation: string | null };
    const lotInfoMap = new Map<string, { condition: string | null; variation: string | null }>(
      ((lots || []) as LotLite[]).map((l) => [
        l.id,
        { condition: l.condition, variation: l.variation || null },
      ])
    );

    type SalesItemRow = {
      id: string;
      qty: number;
      sold_price_pence: number;
      sales_order_id: string;
      sales_orders?: { id: string; sold_at: string | null } | null;
      lot_id: string;
    };

    const items = (salesItems || []) as unknown as SalesItemRow[];
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
      logger.error("Failed to load order profits for card analytics", profitError, undefined, {
        cardId,
        salesOrderIdsCount: orderIds.length,
      });
    }

    const profitMap = new Map((profits || []).map((p) => [p.sales_order_id, p]));

    const priceByDate = new Map<string, { revenue: number; qty: number }>();
    const priceByCondition = new Map<string, { revenue: number; qty: number }>();
    let revenueSum = 0;
    let profitSum = 0;

    for (const item of items) {
      const date = dateKey(item.sales_orders?.sold_at) || "";
      const qty = item.qty || 0;
      const revenue = (item.sold_price_pence || 0) * qty;
      const info = lotInfoMap.get(item.lot_id);
      const condition = info?.condition || "Unknown";
      const variation = info?.variation || "standard";
      const conditionKey = `${condition} • ${variationLabel(variation)}`;

      // Per-date aggregates
      if (!priceByDate.has(date)) priceByDate.set(date, { revenue: 0, qty: 0 });
      const byDate = priceByDate.get(date)!;
      byDate.revenue += revenue;
      byDate.qty += qty;

      // Condition aggregates
      if (!priceByCondition.has(conditionKey))
        priceByCondition.set(conditionKey, { revenue: 0, qty: 0 });
      const byCond = priceByCondition.get(conditionKey)!;
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

    const avgPriceByCondition = Array.from(priceByCondition.entries()).map(([condition, v]) => ({
      condition,
      avg_price_pence: v.qty > 0 ? Math.round(v.revenue / v.qty) : 0,
      qty: v.qty,
    }));

    const qtySoldOverTime = priceHistory.map((p) => ({
      date: p.date,
      qty: p.qty,
    }));

    const avgMarginPercent = revenueSum > 0 ? (profitSum / revenueSum) * 100 : 0;

    return NextResponse.json({
      ok: true,
      priceHistory,
      avgPriceByCondition,
      qtySoldOverTime,
      avgMarginPercent,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_card_analytics", metadata: { cardId } });
  }
}
