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

    // Split purchase history between original and new lot
    // Get purchase history for the original lot
    const { data: purchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("acquisition_id, quantity")
      .eq("lot_id", lotId);

    if (historyError) {
      console.error("Error fetching purchase history:", historyError);
      // Don't fail the split if history fetch fails, but log it
    } else if (purchaseHistory && purchaseHistory.length > 0) {
      // Calculate the proportion to split based on quantities
      const originalQuantity = originalLot.quantity;
      const proportionForNewLot = split_qty / originalQuantity;

      // Split each purchase history entry proportionally
      for (const historyEntry of purchaseHistory) {
        // Calculate how much of this purchase history goes to the new lot
        const splitHistoryQty = Math.floor(historyEntry.quantity * proportionForNewLot);
        const remainingHistoryQty = historyEntry.quantity - splitHistoryQty;

        // Update original lot's history entry (reduce quantity)
        if (remainingHistoryQty > 0) {
          const { error: updateHistoryError } = await supabase
            .from("lot_purchase_history")
            .update({ quantity: remainingHistoryQty })
            .eq("lot_id", lotId)
            .eq("acquisition_id", historyEntry.acquisition_id);

          if (updateHistoryError) {
            console.error("Error updating purchase history:", updateHistoryError);
          }
        } else {
          // If quantity becomes 0, delete the history entry
          await supabase
            .from("lot_purchase_history")
            .delete()
            .eq("lot_id", lotId)
            .eq("acquisition_id", historyEntry.acquisition_id);
        }

        // Create purchase history entry for new split lot
        if (splitHistoryQty > 0) {
          const { error: insertHistoryError } = await supabase
            .from("lot_purchase_history")
            .insert({
              lot_id: createdLot.id,
              acquisition_id: historyEntry.acquisition_id,
              quantity: splitHistoryQty,
            });

          if (insertHistoryError) {
            console.error("Error creating purchase history for split lot:", insertHistoryError);
          }
        }
      }
    } else if (originalLot.acquisition_id) {
      // No purchase history but lot has acquisition_id (legacy lot or trigger hasn't created history yet)
      // Calculate proportional quantities
      const proportionForNewLot = split_qty / originalLot.quantity;
      const splitHistoryQty = Math.floor(originalLot.quantity * proportionForNewLot);
      const remainingHistoryQty = originalLot.quantity - splitHistoryQty;

      // Create history entry for new split lot
      if (splitHistoryQty > 0) {
        const { error: insertNewHistoryError } = await supabase
          .from("lot_purchase_history")
          .insert({
            lot_id: createdLot.id,
            acquisition_id: originalLot.acquisition_id,
            quantity: splitHistoryQty,
          });

        if (insertNewHistoryError) {
          console.error("Error creating purchase history for split lot:", insertNewHistoryError);
        }
      }

      // Create/update history entry for original lot with remaining quantity
      if (remainingHistoryQty > 0) {
        const { error: upsertHistoryError } = await supabase
          .from("lot_purchase_history")
          .upsert(
            {
              lot_id: lotId,
              acquisition_id: originalLot.acquisition_id,
              quantity: remainingHistoryQty,
            },
            {
              onConflict: "lot_id,acquisition_id",
            }
          );

        if (upsertHistoryError) {
          console.error("Error updating purchase history for original lot:", upsertHistoryError);
        }
      } else {
        // If remaining quantity is 0, delete the history entry if it exists
        await supabase
          .from("lot_purchase_history")
          .delete()
          .eq("lot_id", lotId)
          .eq("acquisition_id", originalLot.acquisition_id);
      }
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

