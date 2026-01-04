import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Get all purchases
    const { data: acquisitions, error: acqError } = await supabase
      .from("acquisitions")
      .select("id, purchase_total_pence");

    if (acqError) {
      console.error("Error fetching acquisitions:", acqError);
      return NextResponse.json(
        { error: acqError.message || "Failed to fetch purchases" },
        { status: 500 }
      );
    }

    const total_purchase_cost_pence = (acquisitions || []).reduce(
      (sum, acq) => sum + (acq.purchase_total_pence || 0),
      0
    );

    // Get all sales orders and calculate revenue (using view to account for discounts)
    const { data: profitData, error: profitError } = await supabase
      .from("v_sales_order_profit")
      .select("revenue_after_discount_pence");

    if (profitError) {
      console.error("Error fetching profit data:", profitError);
      return NextResponse.json(
        { error: profitError.message || "Failed to fetch profit data" },
        { status: 500 }
      );
    }

    const total_revenue_pence = (profitData || []).reduce(
      (sum, p) => sum + (p.revenue_after_discount_pence || 0),
      0
    );

    // Get sales order IDs for consumables lookup
    const { data: salesOrders } = await supabase
      .from("sales_orders")
      .select("id");
    
    const salesOrderIds = (salesOrders || []).map((o: any) => o.id);

    // Get all consumables costs from sales
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

      // Get consumable costs
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

        // Calculate total consumables cost
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

    // Calculate overall profit/loss
    const total_costs_pence = total_purchase_cost_pence + total_consumables_cost_pence;
    const net_profit_pence = total_revenue_pence - total_costs_pence;
    const margin_percent =
      total_revenue_pence > 0 ? (net_profit_pence / total_revenue_pence) * 100 : 0;

    return NextResponse.json({
      ok: true,
      profit: {
        purchase_cost_pence: total_purchase_cost_pence,
        revenue_pence: total_revenue_pence,
        consumables_cost_pence: total_consumables_cost_pence,
        total_costs_pence,
        net_profit_pence,
        margin_percent,
      },
    });
  } catch (error: any) {
    console.error("Error in overall profit API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

