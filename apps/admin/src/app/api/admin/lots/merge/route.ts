import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lot_ids, target_lot_id } = body;

    if (!Array.isArray(lot_ids) || lot_ids.length < 2) {
      return NextResponse.json(
        { error: "Must provide at least 2 lot IDs to merge" },
        { status: 400 }
      );
    }

    if (!target_lot_id || !lot_ids.includes(target_lot_id)) {
      return NextResponse.json(
        { error: "Must specify a target lot ID that is in the list of lots to merge" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch all lots to merge
    const { data: lotsToMerge, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("*")
      .in("id", lot_ids);

    if (fetchError || !lotsToMerge || lotsToMerge.length !== lot_ids.length) {
      return NextResponse.json(
        { error: "Failed to fetch lots or some lots not found" },
        { status: 404 }
      );
    }

    // Verify all lots have the same card_id and condition
    const targetLot = lotsToMerge.find((l: any) => l.id === target_lot_id);
    if (!targetLot) {
      return NextResponse.json(
        { error: "Target lot not found" },
        { status: 404 }
      );
    }

    const allMatch = lotsToMerge.every(
      (lot: any) =>
        lot.card_id === targetLot.card_id &&
        lot.condition === targetLot.condition
    );

    if (!allMatch) {
      return NextResponse.json(
        { error: "All lots must have the same card and condition to merge" },
        { status: 400 }
      );
    }

    // Check for sold quantities - can't merge if any have sold items
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lot_ids);

    const soldItemsMap = new Map<string, number>();
    (soldItems || []).forEach((item: any) => {
      const current = soldItemsMap.get(item.lot_id) || 0;
      soldItemsMap.set(item.lot_id, current + (item.qty || 0));
    });

    const lotsWithSales = lotsToMerge.filter(
      (lot: any) => (soldItemsMap.get(lot.id) || 0) > 0
    );

    if (lotsWithSales.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot merge lots that have sold items. Please split sold items first.",
          lots_with_sales: lotsWithSales.map((l: any) => l.id),
        },
        { status: 400 }
      );
    }

    // Calculate total quantity
    const totalQuantity = lotsToMerge.reduce(
      (sum, lot: any) => sum + lot.quantity,
      0
    );

    // Determine merged values (use target lot's values, or merge logic for some fields)
    const mergedLot = {
      quantity: totalQuantity,
      for_sale: targetLot.for_sale, // Use target lot's for_sale setting
      list_price_pence: targetLot.list_price_pence, // Use target lot's price
      note: targetLot.note || lotsToMerge.find((l: any) => l.note)?.note || null, // Use first available note
      use_api_image: targetLot.use_api_image || lotsToMerge.some((l: any) => l.use_api_image), // If any use API image, keep it
    };

    // Update target lot with merged values
    const { error: updateError } = await supabase
      .from("inventory_lots")
      .update(mergedLot)
      .eq("id", target_lot_id);

    if (updateError) {
      console.error("Error updating target lot:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update target lot" },
        { status: 500 }
      );
    }

    // Copy photos from other lots to target lot
    const otherLotIds = lot_ids.filter((id: string) => id !== target_lot_id);
    if (otherLotIds.length > 0) {
      const { data: photosToCopy } = await supabase
        .from("lot_photos")
        .select("kind, object_key")
        .in("lot_id", otherLotIds);

      if (photosToCopy && photosToCopy.length > 0) {
        // Get existing photos for target lot to avoid duplicates
        const { data: existingPhotos } = await supabase
          .from("lot_photos")
          .select("kind, object_key")
          .eq("lot_id", target_lot_id);

        const existingKeys = new Set(
          (existingPhotos || []).map(
            (p: any) => `${p.kind}:${p.object_key}`
          )
        );

        const photosToInsert = photosToCopy
          .filter(
            (p: any) => !existingKeys.has(`${p.kind}:${p.object_key}`)
          )
          .map((p: any) => ({
            lot_id: target_lot_id,
            kind: p.kind,
            object_key: p.object_key,
          }));

        if (photosToInsert.length > 0) {
          const { error: photoError } = await supabase
            .from("lot_photos")
            .insert(photosToInsert);

          if (photoError) {
            console.error("Error copying photos:", photoError);
            // Don't fail the merge if photos fail
          }
        }
      }
    }

    // Delete the other lots (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from("inventory_lots")
      .delete()
      .in("id", otherLotIds);

    if (deleteError) {
      console.error("Error deleting merged lots:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete merged lots" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      merged_lot: {
        id: target_lot_id,
        quantity: totalQuantity,
      },
      merged_count: lot_ids.length,
    });
  } catch (error: any) {
    console.error("Error in merge API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

