import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { poundsToPence } from "@pokeflip/shared";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { split_qty, for_sale, list_price_pence, condition } = body;

    if (!split_qty || split_qty < 1) {
      return NextResponse.json(
        { error: "Invalid split quantity" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch the original lot
    const { data: originalLot, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("*")
      .eq("id", lotId)
      .single();

    if (fetchError || !originalLot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      );
    }

    // Check available quantity (can't split more than available)
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("qty")
      .eq("lot_id", lotId);

    const soldQty = (soldItems || []).reduce((sum, item) => sum + (item.qty || 0), 0);
    const availableQty = originalLot.quantity - soldQty;

    if (split_qty >= availableQty) {
      return NextResponse.json(
        { error: `Split quantity must be less than available quantity (${availableQty})` },
        { status: 400 }
      );
    }

    // Create the new split lot
    // If for_sale is false, set status to 'draft' to keep it in pending state
    // If for_sale is true but status is 'listed', set to 'draft' or 'ready' to keep it in inbox
    // Otherwise preserve the original status
    let newLotStatus = originalLot.status;
    if (for_sale === false) {
      newLotStatus = "draft";
    } else if (originalLot.status === "listed" && for_sale === true) {
      // If splitting from a listed lot but keeping for_sale, set to 'ready' so it appears in inbox
      newLotStatus = "ready";
    }
    
    // Handle list_price_pence: it can be a string (pounds) or number (pence)
    let finalListPricePence = originalLot.list_price_pence;
    if (list_price_pence != null) {
      if (typeof list_price_pence === "string") {
        // String format (pounds) - convert to pence
        finalListPricePence = poundsToPence(list_price_pence);
      } else if (typeof list_price_pence === "number") {
        // Already in pence - use directly
        finalListPricePence = list_price_pence;
      }
    }

    const newLot: any = {
      card_id: originalLot.card_id,
      condition: condition || originalLot.condition,
      variation: originalLot.variation || "standard",
      quantity: split_qty,
      for_sale: for_sale ?? originalLot.for_sale,
      list_price_pence: finalListPricePence,
      status: newLotStatus,
      acquisition_id: originalLot.acquisition_id,
      note: originalLot.note,
      use_api_image: originalLot.use_api_image || false,
    };

    const { data: createdLot, error: insertError } = await supabase
      .from("inventory_lots")
      .insert(newLot)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating split lot:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to create split lot" },
        { status: 500 }
      );
    }

    // Copy photos from original lot to new lot
    const { data: photos } = await supabase
      .from("lot_photos")
      .select("kind, object_key")
      .eq("lot_id", lotId);

    if (photos && photos.length > 0) {
      const photoInserts = photos.map((photo) => ({
        lot_id: createdLot.id,
        kind: photo.kind,
        object_key: photo.object_key,
      }));

      const { error: photoError } = await supabase
        .from("lot_photos")
        .insert(photoInserts);

      if (photoError) {
        console.error("Error copying photos:", photoError);
        // Don't fail the whole operation if photos fail
      }
    }

    // Update the original lot's quantity
    const newQuantity = originalLot.quantity - split_qty;
    const { error: updateError } = await supabase
      .from("inventory_lots")
      .update({ quantity: newQuantity })
      .eq("id", lotId);

    if (updateError) {
      console.error("Error updating original lot:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update original lot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      original_lot: { id: lotId, quantity: newQuantity },
      split_lot: createdLot,
    });
  } catch (error: any) {
    console.error("Error in split API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

