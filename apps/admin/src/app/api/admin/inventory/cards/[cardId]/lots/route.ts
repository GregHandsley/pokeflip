import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const supabase = supabaseServer();

    // Fetch all lots for this card
    const { data: lots, error } = await supabase
      .from("inventory_lots")
      .select("*")
      .eq("card_id", cardId)
      .order("condition", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching lots:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch lots" },
        { status: 500 }
      );
    }

    if (!lots || lots.length === 0) {
      return NextResponse.json({
        ok: true,
        lots: [],
      });
    }

    // Get sold quantities from sales_items
    const lotIds = lots.map((l: any) => l.id);
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lotIds);

    const soldItemsMap = new Map<string, number>();
    (soldItems || []).forEach((item: any) => {
      const current = soldItemsMap.get(item.lot_id) || 0;
      soldItemsMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Get eBay listing status
    const { data: ebayListings } = await supabase
      .from("ebay_listings")
      .select("lot_id, status")
      .in("lot_id", lotIds);

    const ebayMap = new Map();
    (ebayListings || []).forEach((listing: any) => {
      ebayMap.set(listing.lot_id, listing.status);
    });

    // Get photo counts
    const { data: photoCounts } = await supabase
      .from("lot_photos")
      .select("lot_id")
      .in("lot_id", lotIds);

    const photoCountsMap = new Map<string, number>();
    (photoCounts || []).forEach((photo: any) => {
      const current = photoCountsMap.get(photo.lot_id) || 0;
      photoCountsMap.set(photo.lot_id, current + 1);
    });

    // Get purchase (acquisition) info for lots that have it
    const acquisitionIds = lots
      .map((l: any) => l.acquisition_id)
      .filter((id: any) => id != null) as string[];
    
    const purchaseMap = new Map<string, any>();
    if (acquisitionIds.length > 0) {
      const { data: acquisitions } = await supabase
        .from("acquisitions")
        .select("id, source_name, source_type, purchased_at, status")
        .in("id", acquisitionIds);
      
      (acquisitions || []).forEach((acq: any) => {
        purchaseMap.set(acq.id, {
          id: acq.id,
          source_name: acq.source_name,
          source_type: acq.source_type,
          purchased_at: acq.purchased_at,
          status: acq.status,
        });
      });
    }

    // Format lots with available qty and related data
    const formattedLots = lots.map((lot: any) => {
      const soldQty = soldItemsMap.get(lot.id) || 0;
      const availableQty = Math.max(0, lot.quantity - soldQty);
      const purchase = lot.acquisition_id ? purchaseMap.get(lot.acquisition_id) : null;

      return {
        id: lot.id,
        condition: lot.condition,
        quantity: lot.quantity,
        available_qty: availableQty,
        sold_qty: soldQty,
        for_sale: lot.for_sale,
        list_price_pence: lot.list_price_pence,
        status: lot.status,
        note: lot.note,
        created_at: lot.created_at,
        updated_at: lot.updated_at,
        ebay_status: ebayMap.get(lot.id) || "not_listed",
        photo_count: photoCountsMap.get(lot.id) || 0,
        purchase: purchase || null,
      };
    });

    return NextResponse.json({
      ok: true,
      lots: formattedLots,
    });
  } catch (error: any) {
    console.error("Error in lots API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

