import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const supabase = supabaseServer();

    // First, get all lot IDs for this card to delete related records
    const { data: lots, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("card_id", cardId);

    if (fetchError) {
      console.error("Error fetching lots to delete:", fetchError);
      return NextResponse.json(
        { error: fetchError.message || "Failed to fetch lots" },
        { status: 500 }
      );
    }

    if (!lots || lots.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No inventory found for this card",
      });
    }

    const lotIds = lots.map((l) => l.id);

    // Delete all related records explicitly to keep database lean
    // Delete lot photos
    const { error: photosError } = await supabase
      .from("lot_photos")
      .delete()
      .in("lot_id", lotIds);
    if (photosError) {
      console.warn("Error deleting lot photos:", photosError);
    }
    
    // Delete eBay listings
    const { error: ebayError } = await supabase
      .from("ebay_listings")
      .delete()
      .in("lot_id", lotIds);
    if (ebayError) {
      console.warn("Error deleting eBay listings:", ebayError);
    }
    
    // Delete sales_items to keep database lean (as requested)
    // This removes historical sales data for these lots
    const { error: salesError } = await supabase
      .from("sales_items")
      .delete()
      .in("lot_id", lotIds);
    if (salesError) {
      console.warn("Error deleting sales items:", salesError);
    }

    // Delete all inventory lots for this card
    // This is the main deletion - cascade will handle some, but we've been explicit above
    const { error } = await supabase
      .from("inventory_lots")
      .delete()
      .eq("card_id", cardId);

    if (error) {
      console.error("Error deleting inventory lots:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete inventory" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Inventory deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete inventory API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

