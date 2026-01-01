import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    // Find the sales order that contains this lot
    const { data: salesItem, error } = await supabase
      .from("sales_items")
      .select("sales_order_id")
      .eq("lot_id", lotId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !salesItem) {
      return NextResponse.json({
        ok: true,
        salesOrderId: null,
      });
    }

    return NextResponse.json({
      ok: true,
      salesOrderId: salesItem.sales_order_id,
    });
  } catch (error: any) {
    console.error("Error in get sales order for lot API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

