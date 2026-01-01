import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ acquisitionId: string }> }
) {
  try {
    const { acquisitionId } = await params;
    const supabase = supabaseServer();

    // Fetch the purchase info
    const { data: acquisition, error: acqError } = await supabase
      .from("acquisitions")
      .select("*")
      .eq("id", acquisitionId)
      .single();

    if (acqError || !acquisition) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Fetch all lots from this purchase
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity")
      .eq("acquisition_id", acquisitionId);

    if (lotsError) {
      console.error("Error fetching lots:", lotsError);
      return NextResponse.json(
        { error: lotsError.message || "Failed to fetch cards" },
        { status: 500 }
      );
    }

    const lotIds = (lots || []).map((l: any) => l.id);

    if (lotIds.length === 0) {
      return NextResponse.json({
        ok: true,
        profit: {
          purchase_cost_pence: acquisition.purchase_total_pence,
          revenue_pence: 0,
          consumables_cost_pence: 0,
          net_profit_pence: -acquisition.purchase_total_pence,
          margin_percent: 0,
          cards_sold: 0,
          cards_total: 0,
        },
      });
    }

    // Get all sales_items for these lots
    const { data: salesItems, error: salesError } = await supabase
      .from("sales_items")
      .select(`
        id,
        qty,
        sold_price_pence,
        sales_order_id,
        sales_orders (
          id
        )
      `)
      .in("lot_id", lotIds);

    if (salesError) {
      console.error("Error fetching sales items:", salesError);
      return NextResponse.json(
        { error: salesError.message || "Failed to fetch sales" },
        { status: 500 }
      );
    }

    // Calculate revenue from sales
    const revenue_pence = (salesItems || []).reduce(
      (sum, item) => sum + (item.qty || 0) * (item.sold_price_pence || 0),
      0
    );

    // Get unique sales_order_ids
    const salesOrderIds = [
      ...new Set(
        (salesItems || [])
          .map((item: any) => item.sales_order_id)
          .filter(Boolean)
      ),
    ];

    // Get consumables costs from sales_orders
    let consumables_cost_pence = 0;
    if (salesOrderIds.length > 0) {
      // Get consumables for these sales orders
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
        consumables_cost_pence = (salesConsumables || []).reduce(
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

    // Calculate profit/loss
    const purchase_cost_pence = acquisition.purchase_total_pence;
    const total_costs_pence = purchase_cost_pence + consumables_cost_pence;
    const net_profit_pence = revenue_pence - total_costs_pence;
    
    // Net margin: (Net Profit / Revenue) * 100
    const margin_percent =
      revenue_pence > 0
        ? (net_profit_pence / revenue_pence) * 100
        : 0;
    
    // ROI (Return on Investment): (Net Profit / Purchase Cost) * 100
    const roi_percent =
      purchase_cost_pence > 0
        ? (net_profit_pence / purchase_cost_pence) * 100
        : 0;

    // Count cards sold vs total
    const cards_sold = (salesItems || []).reduce(
      (sum, item) => sum + (item.qty || 0),
      0
    );
    const cards_total = (lots || []).reduce(
      (sum, lot: any) => sum + (lot.quantity || 0),
      0
    );

    return NextResponse.json({
      ok: true,
      profit: {
        purchase_cost_pence,
        revenue_pence,
        consumables_cost_pence,
        total_costs_pence,
        net_profit_pence,
        margin_percent,
        roi_percent,
        cards_sold,
        cards_total,
      },
    });
  } catch (error: any) {
    console.error("Error in purchase profit API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

