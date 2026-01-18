export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { nonEmptyArray, uuid, min, required } from "@/lib/validation";
import { logAudit, getCurrentUser } from "@/lib/audit";

type InventoryLotRow = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
  sku: string | null;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  note: string | null;
  use_api_image: boolean;
  acquisition_id: string | null;
};

type SalesItemRow = {
  lot_id: string;
  qty: number;
};

type PurchaseHistoryRow = {
  lot_id: string;
  acquisition_id: string;
  quantity: number;
};

type PhotoRow = {
  kind: string;
  object_key: string;
};

type MergedLotUpdate = {
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  note: string | null;
  use_api_image: boolean;
  variation: string;
  acquisition_id?: string | null;
};

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  let validatedLotIds: string[] = [];
  let validatedTargetLotId = "";

  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);

  try {
    const body = await req.json();

    // Validate lot_ids array
    validatedLotIds = nonEmptyArray(body.lot_ids, "lot_ids");
    min(validatedLotIds.length, 2, "lot_ids.length");

    // Validate each lot ID is a UUID
    validatedLotIds.forEach((id: unknown, index: number) => {
      uuid(id, `lot_ids[${index}]`);
    });

    // Validate target_lot_id
    validatedTargetLotId = uuid(required(body.target_lot_id, "target_lot_id"), "target_lot_id");

    // Validate target is in the list
    if (!validatedLotIds.includes(validatedTargetLotId)) {
      return createErrorResponse(
        "target_lot_id must be in the list of lots to merge",
        400,
        "INVALID_TARGET_LOT"
      );
    }

    const supabase = supabaseServer();

    // Fetch all lots to merge
    const { data: lotsToMerge, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("*")
      .in("id", validatedLotIds);

    if (fetchError || !lotsToMerge || lotsToMerge.length !== validatedLotIds.length) {
      return createErrorResponse(
        "Failed to fetch lots or some lots not found",
        404,
        "LOTS_NOT_FOUND"
      );
    }

    // Verify all lots have the same card_id and condition
    const targetLot = lotsToMerge.find((l: InventoryLotRow) => l.id === validatedTargetLotId);
    if (!targetLot) {
      return NextResponse.json({ error: "Target lot not found" }, { status: 404 });
    }

    // Verify all lots have the same SKU (ensures same card, condition, and variation)
    // This is the most reliable check since SKU is unique per card+condition+variation combination
    const targetSku = targetLot.sku;
    if (!targetSku) {
      return NextResponse.json({ error: "Target lot must have a SKU to merge" }, { status: 400 });
    }

    const allMatchSku = lotsToMerge.every(
      (lot: InventoryLotRow) => lot.sku && lot.sku === targetSku
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
      (lot: InventoryLotRow) =>
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
      .in("lot_id", validatedLotIds);

    const soldItemsMap = new Map<string, number>();
    (soldItems || []).forEach((item: SalesItemRow) => {
      const current = soldItemsMap.get(item.lot_id) || 0;
      soldItemsMap.set(item.lot_id, current + (item.qty || 0));
    });

    const lotsWithSales = lotsToMerge.filter(
      (lot: InventoryLotRow) => (soldItemsMap.get(lot.id) || 0) > 0
    );

    if (lotsWithSales.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot merge lots that have sold items. Please split sold items first.",
          lots_with_sales: lotsWithSales.map((l: InventoryLotRow) => l.id),
        },
        { status: 400 }
      );
    }

    // Calculate total quantity
    const totalQuantity = lotsToMerge.reduce((sum, lot: InventoryLotRow) => sum + lot.quantity, 0);

    // Check if lots come from different purchases
    const uniqueAcquisitionIds = new Set(
      lotsToMerge
        .map((l: InventoryLotRow) => l.acquisition_id)
        .filter((id: string | null): id is string => id !== null && id !== undefined)
    );

    // Determine merged values (use target lot's values, or merge logic for some fields)
    const mergedLot: MergedLotUpdate = {
      quantity: totalQuantity,
      for_sale: targetLot.for_sale, // Use target lot's for_sale setting
      list_price_pence: targetLot.list_price_pence, // Use target lot's price
      note: targetLot.note || lotsToMerge.find((l: InventoryLotRow) => l.note)?.note || null, // Use first available note
      use_api_image:
        targetLot.use_api_image || lotsToMerge.some((l: InventoryLotRow) => l.use_api_image), // If any use API image, keep it
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
      .eq("id", validatedTargetLotId);

    if (updateError) {
      logger.error("Failed to update target lot during merge", undefined, {
        targetLotId: validatedTargetLotId,
        lotIds: validatedLotIds,
        error: updateError,
      });
      return NextResponse.json(
        { error: updateError.message || "Failed to update target lot" },
        { status: 500 }
      );
    }

    // Get other lot IDs (excluding target) for later operations
    const otherLotIds = validatedLotIds.filter(
      (id: unknown) => id !== validatedTargetLotId
    ) as string[];

    // Merge purchase history from all lots into target lot
    // This preserves the original committed quantities from each purchase
    // Get purchase history from all lots being merged (including target)
    const { data: allPurchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, acquisition_id, quantity")
      .in("lot_id", validatedLotIds);

    if (historyError) {
      logger.error("Failed to fetch purchase history during merge", undefined, {
        targetLotId: validatedTargetLotId,
        lotIds: validatedLotIds,
        error: historyError,
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
    lotsToMerge.forEach((lot: InventoryLotRow) => {
      if (lot.acquisition_id) {
        lotAcquisitionMap.set(lot.id, lot.acquisition_id);
      }
    });

    // Group by acquisition_id and sum quantities from purchase history
    // This preserves the original committed quantities from each purchase
    const historyMap = new Map<string, number>();

    // Add quantities from lot_purchase_history (this is the source of truth)
    (allPurchaseHistory || []).forEach((entry: PurchaseHistoryRow) => {
      const current = historyMap.get(entry.acquisition_id) || 0;
      historyMap.set(entry.acquisition_id, current + (entry.quantity || 0));
    });

    // For lots that have acquisition_id but no history entry (legacy lots),
    // add their quantity to preserve the original committed amount
    lotsToMerge.forEach((lot: InventoryLotRow) => {
      if (lot.acquisition_id) {
        // Check if this lot has any history entries
        const lotHasHistory = allPurchaseHistory?.some(
          (h: PurchaseHistoryRow) => h.lot_id === lot.id
        );
        if (!lotHasHistory) {
          // This lot has acquisition_id but no history entry - add its quantity
          const current = historyMap.get(lot.acquisition_id) || 0;
          historyMap.set(lot.acquisition_id, current + lot.quantity);
        }
      }
    });

    // Delete existing history for target lot (will recreate with merged data)
    await supabase.from("lot_purchase_history").delete().eq("lot_id", validatedTargetLotId);

    // Insert merged purchase history preserving original quantities from each purchase
    const historyInserts = Array.from(historyMap.entries()).map(([acquisitionId, qty]) => ({
      lot_id: validatedTargetLotId,
      acquisition_id: acquisitionId,
      quantity: qty,
    }));

    if (historyInserts.length > 0) {
      const { error: insertHistoryError } = await supabase
        .from("lot_purchase_history")
        .insert(historyInserts);

      if (insertHistoryError) {
        logger.error("Failed to insert merged purchase history", undefined, {
          targetLotId: validatedTargetLotId,
          historyInsertsCount: historyInserts.length,
          error: insertHistoryError,
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
          .eq("lot_id", validatedTargetLotId);

        const existingKeys = new Set(
          (existingPhotos || []).map((p: PhotoRow) => `${p.kind}:${p.object_key}`)
        );

        const photosToInsert = photosToCopy
          .filter((p: PhotoRow) => !existingKeys.has(`${p.kind}:${p.object_key}`))
          .map((p: PhotoRow) => ({
            lot_id: validatedTargetLotId,
            kind: p.kind,
            object_key: p.object_key,
          }));

        if (photosToInsert.length > 0) {
          const { error: photoError } = await supabase.from("lot_photos").insert(photosToInsert);

          if (photoError) {
            logger.warn("Failed to copy photos during merge", undefined, {
              targetLotId: validatedTargetLotId,
              photosToInsertCount: photosToInsert.length,
              error: photoError,
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
      logger.error("Failed to delete merged lots", undefined, {
        targetLotId: validatedTargetLotId,
        lotIdsToDelete: validatedLotIds.filter((id) => id !== validatedTargetLotId),
        error: deleteError,
      });
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete merged lots" },
        { status: 500 }
      );
    }

    // Log audit entry for merge (on target lot)
    try {
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "merge_lots",
        entity_type: "inventory_lot",
        entity_id: validatedTargetLotId,
        old_values: {
          quantity: targetLot.quantity,
          merged_lot_ids: [validatedTargetLotId], // Original quantity
        },
        new_values: {
          quantity: totalQuantity,
          merged_lot_ids: validatedLotIds, // All merged lot IDs
        },
        description: `Merged ${validatedLotIds.length} lots into one (total qty: ${totalQuantity})`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      // Don't fail the merge if audit logging fails
      logger.warn("Failed to log audit entry for lot merge", undefined, {
        targetLotId: validatedTargetLotId,
        error: auditError,
      });
    }

    return NextResponse.json({
      ok: true,
      merged_lot: {
        id: validatedTargetLotId,
        quantity: totalQuantity,
      },
      merged_count: validatedLotIds.length,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "merge_lots",
      metadata: { lotIds: validatedLotIds, targetLotId: validatedTargetLotId },
    });
  }
}
