import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const supabase = supabaseServer();

    // Get profit data from the view
    const { data: profit, error } = await supabase
      .from("v_sales_order_profit")
      .select("*")
      .eq("sales_order_id", orderId)
      .single();

    if (error) {
      console.error("Error fetching profit data:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch profit data" },
        { status: 500 }
      );
    }

    if (!profit) {
      return NextResponse.json(
        { error: "Sales order not found" },
        { status: 404 }
      );
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
    const consumableIds = (consumables || []).map((c: any) => c.consumable_id);
    let consumableCosts: any[] = [];
    if (consumableIds.length > 0) {
      const { data: costs } = await supabase
        .from("v_consumable_costs")
        .select("*")
        .in("consumable_id", consumableIds);
      consumableCosts = costs || [];
    }

    // Calculate detailed consumables cost
    const consumablesBreakdown = (consumables || []).map((sc: any) => {
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
  } catch (error: any) {
    console.error("Error in profit API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


