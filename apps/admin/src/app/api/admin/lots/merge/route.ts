import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  
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

    // Verify all lots have the same SKU (ensures same card, condition, and variation)
    // This is the most reliable check since SKU is unique per card+condition+variation combination
    const targetSku = targetLot.sku;
    if (!targetSku) {
      return NextResponse.json(
        { error: "Target lot must have a SKU to merge" },
        { status: 400 }
      );
    }

    const allMatchSku = lotsToMerge.every(
      (lot: any) => lot.sku && lot.sku === targetSku
    );

    if (!allMatchSku) {
      return NextResponse.json(
        { error: "All lots must have the same SKU to merge (same card, condition, and variation)" },
        { status: 400 }
      );
    }

    // Also verify card_id, condition, and variation match as a secondary check
    // (this should always be true if SKUs match, but provides additional validation)
    const allMatch = lotsToMerge.every(
      (lot: any) =>
        lot.card_id === targetLot.card_id &&
        lot.condition === targetLot.condition &&
        (lot.variation || "standard") === (targetLot.variation || "standard")
    );

    if (!allMatch) {
      return NextResponse.json(
        { error: "All lots must have the same card, condition, and variation to merge" },
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

    // Check if lots come from different purchases
    const uniqueAcquisitionIds = new Set(
      lotsToMerge
        .map((l: any) => l.acquisition_id)
        .filter((id: any) => id !== null && id !== undefined)
    );

    // Determine merged values (use target lot's values, or merge logic for some fields)
    const mergedLot: any = {
      quantity: totalQuantity,
      for_sale: targetLot.for_sale, // Use target lot's for_sale setting
      list_price_pence: targetLot.list_price_pence, // Use target lot's price
      note: targetLot.note || lotsToMerge.find((l: any) => l.note)?.note || null, // Use first available note
      use_api_image: targetLot.use_api_image || lotsToMerge.some((l: any) => l.use_api_image), // If any use API image, keep it
      variation: targetLot.variation || "standard",
    };

    // If merging lots from different purchases, set acquisition_id to null
    // The purchase history will be tracked in lot_purchase_history instead
    if (uniqueAcquisitionIds.size > 1) {
      mergedLot.acquisition_id = null;
    } else if (uniqueAcquisitionIds.size === 1) {
      // All lots from same purchase - keep that acquisition_id
      mergedLot.acquisition_id = Array.from(uniqueAcquisitionIds)[0];
    }
    // If size is 0, leave acquisition_id as is (null)

    // Update target lot with merged values
    const { error: updateError } = await supabase
      .from("inventory_lots")
      .update(mergedLot)
      .eq("id", target_lot_id);

    if (updateError) {
      logger.error("Failed to update target lot during merge", updateError, undefined, {
        targetLotId: target_lot_id,
        lotIds,
      });
      return NextResponse.json(
        { error: updateError.message || "Failed to update target lot" },
        { status: 500 }
      );
    }

    // Get other lot IDs (excluding target) for later operations
    const otherLotIds = lot_ids.filter((id: string) => id !== target_lot_id);

    // Merge purchase history from all lots into target lot
    // This preserves the original committed quantities from each purchase
    // Get purchase history from all lots being merged (including target)
    const { data: allPurchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, acquisition_id, quantity")
      .in("lot_id", lot_ids);

    if (historyError) {
      logger.error("Failed to fetch purchase history during merge", historyError, undefined, {
        targetLotId: target_lot_id,
        lotIds,
      });
      return createErrorResponse(
        "Failed to fetch purchase history for merge",
        500,
        "FETCH_PURCHASE_HISTORY_FAILED",
        historyError
      );
    }

    // Build a map of lot_id -> acquisition_id for lots that have acquisition_id
    const lotAcquisitionMap = new Map<string, string>();
    lotsToMerge.forEach((lot: any) => {
      if (lot.acquisition_id) {
        lotAcquisitionMap.set(lot.id, lot.acquisition_id);
      }
    });

    // Group by acquisition_id and sum quantities from purchase history
    // This preserves the original committed quantities from each purchase
    const historyMap = new Map<string, number>();
    
    // Add quantities from lot_purchase_history (this is the source of truth)
    (allPurchaseHistory || []).forEach((entry: any) => {
      const current = historyMap.get(entry.acquisition_id) || 0;
      historyMap.set(entry.acquisition_id, current + (entry.quantity || 0));
    });

    // For lots that have acquisition_id but no history entry (legacy lots),
    // add their quantity to preserve the original committed amount
    lotsToMerge.forEach((lot: any) => {
      if (lot.acquisition_id) {
        // Check if this lot has any history entries
        const lotHasHistory = allPurchaseHistory?.some((h: any) => h.lot_id === lot.id);
        if (!lotHasHistory) {
          // This lot has acquisition_id but no history entry - add its quantity
          const current = historyMap.get(lot.acquisition_id) || 0;
          historyMap.set(lot.acquisition_id, current + lot.quantity);
        }
      }
    });

    // Delete existing history for target lot (will recreate with merged data)
    await supabase
      .from("lot_purchase_history")
      .delete()
      .eq("lot_id", target_lot_id);

    // Insert merged purchase history preserving original quantities from each purchase
    const historyInserts = Array.from(historyMap.entries()).map(([acquisitionId, qty]) => ({
      lot_id: target_lot_id,
      acquisition_id: acquisitionId,
      quantity: qty,
    }));

    if (historyInserts.length > 0) {
      const { error: insertHistoryError } = await supabase
        .from("lot_purchase_history")
        .insert(historyInserts);

      if (insertHistoryError) {
        logger.error("Failed to insert merged purchase history", insertHistoryError, undefined, {
          targetLotId: target_lot_id,
          historyInsertsCount: historyInserts.length,
        });
        return createErrorResponse(
          "Failed to preserve purchase history during merge",
          500,
          "INSERT_PURCHASE_HISTORY_FAILED",
          insertHistoryError
        );
      }
    }

    // Copy photos from other lots to target lot
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
            logger.warn("Failed to copy photos during merge", photoError, undefined, {
              targetLotId: target_lot_id,
              photosToInsertCount: photosToInsert.length,
            });
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
      logger.error("Failed to delete merged lots", deleteError, undefined, {
        targetLotId: target_lot_id,
        lotIdsToDelete: lotIds.filter((id) => id !== target_lot_id),
      });
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
    return handleApiError(req, error, {
      operation: "merge_lots",
      metadata: { lotIds, targetLotId: target_lot_id },
    });
  }
}

