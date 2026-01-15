import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type ConsumableRow = {
  id: string;
  name: string;
  unit: string;
};

type SalesConsumableRow = {
  consumable_id: string;
  qty: number;
  consumables: ConsumableRow | null;
};

type ConsumableCostRow = {
  consumable_id: string;
  avg_cost_pence_per_unit: number;
};

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const logger = createApiLogger(req);
  let orderId: string = "";

  try {
    const paramsResult = await params;
    orderId = paramsResult.orderId;
    const supabase = supabaseServer();

    // Get profit data from the view
    const { data: profit, error } = await supabase
      .from("v_sales_order_profit")
      .select("*")
      .eq("sales_order_id", orderId)
      .single();

    if (error) {
      logger.error("Failed to fetch profit data", error, undefined, { orderId });
      return createErrorResponse(
        error.message || "Failed to fetch profit data",
        500,
        "FETCH_PROFIT_DATA_FAILED",
        error
      );
    }

    if (!profit) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    // Get detailed consumables breakdown
    const { data: consumables } = await supabase
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
      .eq("sales_order_id", orderId);

    // Get consumable costs
    const consumableIds = (consumables || []).map((c: SalesConsumableRow) => c.consumable_id);
    let consumableCosts: ConsumableCostRow[] = [];
    if (consumableIds.length > 0) {
      const { data: costs } = await supabase
        .from("v_consumable_costs")
        .select("*")
        .in("consumable_id", consumableIds);
      consumableCosts = costs || [];
    }

    // Calculate detailed consumables cost
    const consumablesBreakdown = (consumables || []).map((sc: SalesConsumableRow) => {
      const cost = consumableCosts.find((c) => c.consumable_id === sc.consumable_id);
      const unitCost = cost?.avg_cost_pence_per_unit || 0;
      const totalCost = sc.qty * unitCost;

      return {
        consumable_id: sc.consumable_id,
        consumable_name: sc.consumables?.name || "",
        qty: sc.qty,
        unit: sc.consumables?.unit || "each",
        unit_cost_pence: unitCost,
        total_cost_pence: totalCost,
      };
    });

    return NextResponse.json({
      ok: true,
      profit: {
        ...profit,
        consumables_breakdown: consumablesBreakdown,
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_order_profit", metadata: { orderId } });
  }
}
