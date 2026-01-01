import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { for_sale, list_price_pence, item_number } = body;

    if (for_sale === undefined) {
      return NextResponse.json(
        { error: "for_sale is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Prepare update object
    const updateData: { 
      for_sale: boolean; 
      list_price_pence?: number | null;
      item_number?: string | null;
    } = {
      for_sale,
    };

    // If marking as for sale and no price provided, set a default or keep existing
    if (for_sale && list_price_pence !== undefined) {
      updateData.list_price_pence = list_price_pence != null ? Math.round(list_price_pence * 100) : null;
    } else if (!for_sale) {
      // If marking as not for sale, optionally clear the price
      // For now, keep the price but you can clear it if needed
    }

    // Handle item_number - only set when marking as for sale
    if (for_sale && item_number !== undefined) {
      updateData.item_number = item_number && item_number.trim() ? item_number.trim() : null;
    } else if (!for_sale) {
      // Optionally clear item_number when marking as not for sale
      // For now, keep it but you can clear it if needed
    }

    // Update the lot
    const { error } = await supabase
      .from("inventory_lots")
      .update(updateData)
      .eq("id", lotId);

    if (error) {
      console.error("Error updating lot for_sale status:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update for_sale status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Lot marked as ${for_sale ? "for sale" : "not for sale"}`,
    });
  } catch (error: any) {
    console.error("Error in update for_sale API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

