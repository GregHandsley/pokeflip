import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ acquisitionId: string }> }
) {
  try {
    const { acquisitionId } = await params;
    const supabase = supabaseServer();

    // Fetch the acquisition/purchase info
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
      .select(`
        *,
        cards (
          id,
          number,
          name,
          rarity,
          api_image_url,
          sets (
            id,
            name
          )
        )
      `)
      .eq("acquisition_id", acquisitionId)
      .order("created_at", { ascending: false });

    if (lotsError) {
      console.error("Error fetching lots:", lotsError);
      return NextResponse.json(
        { error: lotsError.message || "Failed to fetch lots" },
        { status: 500 }
      );
    }

    const lotIds = (lots || []).map((l: any) => l.id);

    // Get sold quantities from sales_items
    const soldItemsMap = new Map<string, number>();
    if (lotIds.length > 0) {
      const { data: soldItems } = await supabase
        .from("sales_items")
        .select("lot_id, qty")
        .in("lot_id", lotIds);

      (soldItems || []).forEach((item: any) => {
        const current = soldItemsMap.get(item.lot_id) || 0;
        soldItemsMap.set(item.lot_id, current + (item.qty || 0));
      });
    }

    // Get eBay listing statuses
    const ebayMap = new Map();
    if (lotIds.length > 0) {
      const { data: ebayListings } = await supabase
        .from("ebay_listings")
        .select("lot_id, status")
        .in("lot_id", lotIds);

      (ebayListings || []).forEach((listing: any) => {
        ebayMap.set(listing.lot_id, listing.status);
      });
    }

    // Get photo counts
    const photoCountsMap = new Map<string, number>();
    if (lotIds.length > 0) {
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("lot_id")
        .in("lot_id", lotIds);

      (photos || []).forEach((photo: any) => {
        const current = photoCountsMap.get(photo.lot_id) || 0;
        photoCountsMap.set(photo.lot_id, current + 1);
      });
    }

    // Format lots with available qty and related data
    const formattedLots = (lots || []).map((lot: any) => {
      const soldQty = soldItemsMap.get(lot.id) || 0;
      const availableQty = Math.max(0, lot.quantity - soldQty);

      return {
        id: lot.id,
        card_id: lot.card_id,
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
        card: lot.cards ? {
          id: lot.cards.id,
          number: lot.cards.number,
          name: lot.cards.name,
          rarity: lot.cards.rarity,
          image_url: lot.cards.api_image_url,
          set: lot.cards.sets ? {
            id: lot.cards.sets.id,
            name: lot.cards.sets.name,
          } : null,
        } : null,
      };
    });

    return NextResponse.json({
      ok: true,
      purchase: {
        id: acquisition.id,
        source_name: acquisition.source_name,
        source_type: acquisition.source_type,
        purchase_total_pence: acquisition.purchase_total_pence,
        purchased_at: acquisition.purchased_at,
        notes: acquisition.notes,
        status: acquisition.status,
        created_at: acquisition.created_at,
      },
      lots: formattedLots,
    });
  } catch (error: any) {
    console.error("Error in purchase lots API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

