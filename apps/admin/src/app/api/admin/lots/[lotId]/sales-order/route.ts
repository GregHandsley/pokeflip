import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
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
    return handleApiError(req, error, { operation: "get_lot_sales_order", metadata: { lotId } });
  }
}


