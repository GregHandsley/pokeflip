export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  // Extract lotId outside try block so it's available in catch
  const { lotId } = await params;

  try {
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
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_lot_sales_order", metadata: { lotId } });
  }
}
