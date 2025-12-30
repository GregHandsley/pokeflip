import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    // Delete all related records explicitly to keep database lean
    // Delete lot photos (cascade should handle this, but being explicit)
    const { error: photosError } = await supabase
      .from("lot_photos")
      .delete()
      .eq("lot_id", lotId);
    if (photosError) {
      console.warn("Error deleting lot photos:", photosError);
    }
    
    // Delete eBay listings (cascade should handle this, but being explicit)
    const { error: ebayError } = await supabase
      .from("ebay_listings")
      .delete()
      .eq("lot_id", lotId);
    if (ebayError) {
      console.warn("Error deleting eBay listings:", ebayError);
    }
    
    // Delete sales_items to keep database lean
    // Note: This removes historical sales data for this lot
    const { error: salesError } = await supabase
      .from("sales_items")
      .delete()
      .eq("lot_id", lotId);
    if (salesError) {
      console.warn("Error deleting sales items:", salesError);
    }

    // Delete the inventory lot itself
    const { error } = await supabase
      .from("inventory_lots")
      .delete()
      .eq("id", lotId);

    if (error) {
      console.error("Error deleting inventory lot:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete lot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Lot deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete lot API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

