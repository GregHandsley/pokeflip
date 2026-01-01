import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    // Get the current lot to find its item_number
    const { data: currentLot, error: lotError } = await supabase
      .from("inventory_lots")
      .select("item_number, card_id, condition, quantity, status, use_api_image")
      .eq("id", lotId)
      .single();

    if (lotError || !currentLot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      );
    }

    // If no item_number, return empty group
    if (!currentLot.item_number) {
      return NextResponse.json({
        ok: true,
        item_number: null,
        lots: [],
        total_available_qty: 0,
        has_photo_differences: false,
      });
    }

    // Find all lots with the same item_number
    const { data: groupedLots, error: groupedError } = await supabase
      .from("inventory_lots")
      .select(`
        id,
        quantity,
        status,
        use_api_image,
        card_id,
        condition
      `)
      .eq("item_number", currentLot.item_number)
      .eq("status", "ready")
      .order("created_at", { ascending: true });

    if (groupedError) {
      console.error("Error fetching grouped lots:", groupedError);
      return NextResponse.json(
        { error: groupedError.message || "Failed to fetch grouped lots" },
        { status: 500 }
      );
    }

    // Get sold quantities for all lots
    const allLotIds = (groupedLots || []).map((l: any) => l.id);
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", allLotIds);

    const soldItemsMap = new Map<string, number>();
    (soldItems || []).forEach((item: any) => {
      const current = soldItemsMap.get(item.lot_id) || 0;
      soldItemsMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Get photo counts for all lots
    const { data: photos } = await supabase
      .from("lot_photos")
      .select("lot_id, kind")
      .in("lot_id", allLotIds);

    const photoMap = new Map<string, Set<string>>();
    (photos || []).forEach((photo: any) => {
      if (!photoMap.has(photo.lot_id)) {
        photoMap.set(photo.lot_id, new Set());
      }
      photoMap.get(photo.lot_id)!.add(photo.kind);
    });

    // Calculate available quantities and check photo differences
    const currentLotPhotos = photoMap.get(lotId) || new Set();
    const currentLotUseApiImage = currentLot.use_api_image || false;

    const lotsWithDetails = (groupedLots || []).map((lot: any) => {
      const soldQty = soldItemsMap.get(lot.id) || 0;
      const availableQty = Math.max(0, lot.quantity - soldQty);
      const lotPhotos = photoMap.get(lot.id) || new Set();
      const lotUseApiImage = lot.use_api_image || false;

      // Check if photos differ from current lot
      const hasPhotos = lotPhotos.size > 0 || lotUseApiImage;
      const currentHasPhotos = currentLotPhotos.size > 0 || currentLotUseApiImage;
      
      const photosDiffer = 
        (hasPhotos || currentHasPhotos) && 
        (lotPhotos.size !== currentLotPhotos.size ||
         Array.from(lotPhotos).some(kind => !currentLotPhotos.has(kind)) ||
         Array.from(currentLotPhotos).some(kind => !lotPhotos.has(kind)) ||
         lotUseApiImage !== currentLotUseApiImage);

      return {
        id: lot.id,
        available_qty: availableQty,
        quantity: lot.quantity,
        has_photos: hasPhotos,
        photos_differ: photosDiffer,
        photo_kinds: Array.from(lotPhotos),
        use_api_image: lotUseApiImage,
        card_id: lot.card_id,
        condition: lot.condition,
      };
    });

    // Check if any lots have different photos
    const hasPhotoDifferences = lotsWithDetails.some(l => l.photos_differ);

    // Calculate total available quantity across all lots
    const totalAvailableQty = lotsWithDetails.reduce((sum, lot) => sum + lot.available_qty, 0);

    return NextResponse.json({
      ok: true,
      item_number: currentLot.item_number,
      lots: lotsWithDetails,
      total_available_qty: totalAvailableQty,
      has_photo_differences: hasPhotoDifferences,
      group_count: lotsWithDetails.length,
    });
  } catch (error: any) {
    console.error("Error in item group API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

