export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { poundsToPence } from "@pokeflip/shared";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, quantity, optional, boolean, pricePence, cardCondition } from "@/lib/validation";
import { logAudit, getCurrentUser } from "@/lib/audit";

type NewLotData = {
  card_id: string;
  condition: string;
  variation: string;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  acquisition_id: string | null;
  note: string | null;
  use_api_image: boolean;
};

export async function POST(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);
  const { lotId } = await params;

  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);

  try {
    // Validate route parameters
    const validatedLotId = uuid(lotId, "lotId");

    // Validate request body
    const body = await req.json();
    const validatedSplitQty = quantity(body.split_qty, "split_qty");
    const validatedForSale = optional(body.for_sale, boolean, "for_sale");
    const validatedCondition = optional(body.condition, cardCondition, "condition");

    // Handle list_price_pence - can be string (pounds) or number (pence)
    let validatedPrice: number | undefined = undefined;
    if (body.list_price_pence !== undefined && body.list_price_pence !== null) {
      if (typeof body.list_price_pence === "string") {
        // Convert pounds to pence
        validatedPrice = pricePence(poundsToPence(body.list_price_pence), "list_price_pence");
      } else {
        validatedPrice = pricePence(body.list_price_pence, "list_price_pence");
      }
    }

    const supabase = supabaseServer();

    // Fetch the original lot
    const { data: originalLot, error: fetchError } = await supabase
      .from("inventory_lots")
      .select("*")
      .eq("id", validatedLotId)
      .single();

    if (fetchError || !originalLot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Check available quantity (can't split more than available)
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("qty")
      .eq("lot_id", validatedLotId);

    const soldQty = (soldItems || []).reduce((sum, item) => sum + (item.qty || 0), 0);
    const availableQty = originalLot.quantity - soldQty;

    if (validatedSplitQty >= availableQty) {
      return createErrorResponse(
        `Split quantity must be less than available quantity (${availableQty})`,
        400,
        "INVALID_SPLIT_QUANTITY"
      );
    }

    // Create the new split lot
    // If for_sale is false, set status to 'draft' to keep it in pending state
    // If for_sale is true but status is 'listed', set to 'draft' or 'ready' to keep it in inbox
    // Otherwise preserve the original status
    let newLotStatus = originalLot.status;
    if (validatedForSale === false) {
      newLotStatus = "draft";
    } else if (originalLot.status === "listed" && validatedForSale === true) {
      // If splitting from a listed lot but keeping for_sale, set to 'ready' so it appears in inbox
      newLotStatus = "ready";
    }

    const newLot: NewLotData = {
      card_id: originalLot.card_id,
      condition: validatedCondition || originalLot.condition,
      variation: originalLot.variation || "standard",
      quantity: validatedSplitQty,
      for_sale: validatedForSale ?? originalLot.for_sale,
      list_price_pence: validatedPrice ?? originalLot.list_price_pence,
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
      logger.error("Failed to create split lot", insertError, undefined, {
        lotId: validatedLotId,
        splitQty: validatedSplitQty,
      });
      return createErrorResponse(
        insertError.message || "Failed to create split lot",
        500,
        "CREATE_SPLIT_LOT_FAILED",
        insertError
      );
    }

    // Copy photos from original lot to new lot
    const { data: photos } = await supabase
      .from("lot_photos")
      .select("kind, object_key")
      .eq("lot_id", validatedLotId);

    if (photos && photos.length > 0) {
      const photoInserts = photos.map((photo) => ({
        lot_id: createdLot.id,
        kind: photo.kind,
        object_key: photo.object_key,
      }));

      const { error: photoError } = await supabase.from("lot_photos").insert(photoInserts);

      if (photoError) {
        logger.warn("Failed to copy photos during split", undefined, {
          lotId,
          newLotId: createdLot.id,
          photosCount: photos.length,
          error: photoError,
        });
        // Don't fail the whole operation if photos fail
      }
    }

    // Update the original lot's quantity
    const newQuantity = originalLot.quantity - validatedSplitQty;
    const { error: updateError } = await supabase
      .from("inventory_lots")
      .update({ quantity: newQuantity })
      .eq("id", validatedLotId);

    if (updateError) {
      logger.error("Failed to update original lot during split", updateError, undefined, {
        lotId: validatedLotId,
        newQuantity,
        splitQty: validatedSplitQty,
      });
      return createErrorResponse(
        updateError.message || "Failed to update original lot",
        500,
        "UPDATE_ORIGINAL_LOT_FAILED",
        updateError
      );
    }

    // Split purchase history between original and new lot
    // Get purchase history for the original lot
    const { data: purchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("acquisition_id, quantity")
      .eq("lot_id", validatedLotId);

    if (historyError) {
      logger.warn("Failed to fetch purchase history during split", undefined, {
        lotId: validatedLotId,
        error: historyError,
      });
      // Don't fail the split if history fetch fails, but log it
    } else if (purchaseHistory && purchaseHistory.length > 0) {
      // Calculate the proportion to split based on quantities
      const originalQuantity = originalLot.quantity;
      const proportionForNewLot = validatedSplitQty / originalQuantity;

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
            .eq("lot_id", validatedLotId)
            .eq("acquisition_id", historyEntry.acquisition_id);

          if (updateHistoryError) {
            logger.warn("Failed to update purchase history during split", undefined, {
              lotId: validatedLotId,
              acquisitionId: historyEntry.acquisition_id,
              error: updateHistoryError,
            });
          }
        } else {
          // If quantity becomes 0, delete the history entry
          await supabase
            .from("lot_purchase_history")
            .delete()
            .eq("lot_id", validatedLotId)
            .eq("acquisition_id", historyEntry.acquisition_id);
        }

        // Create purchase history entry for new split lot
        if (splitHistoryQty > 0) {
          const { error: insertHistoryError } = await supabase.from("lot_purchase_history").insert({
            lot_id: createdLot.id,
            acquisition_id: historyEntry.acquisition_id,
            quantity: splitHistoryQty,
          });

          if (insertHistoryError) {
            logger.warn("Failed to create purchase history for split lot", undefined, {
              newLotId: createdLot.id,
              acquisitionId: historyEntry.acquisition_id,
              error: insertHistoryError,
            });
          }
        }
      }
    } else if (originalLot.acquisition_id) {
      // No purchase history but lot has acquisition_id (legacy lot or trigger hasn't created history yet)
      // Calculate proportional quantities
      const proportionForNewLot = validatedSplitQty / originalLot.quantity;
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
          logger.warn("Failed to create purchase history for split lot (legacy)", undefined, {
            newLotId: createdLot.id,
            acquisitionId: originalLot.acquisition_id,
            error: insertNewHistoryError,
          });
        }
      }

      // Create/update history entry for original lot with remaining quantity
      if (remainingHistoryQty > 0) {
        const { error: upsertHistoryError } = await supabase.from("lot_purchase_history").upsert(
          {
            lot_id: validatedLotId,
            acquisition_id: originalLot.acquisition_id,
            quantity: remainingHistoryQty,
          },
          {
            onConflict: "lot_id,acquisition_id",
          }
        );

        if (upsertHistoryError) {
          logger.warn("Failed to update purchase history for original lot", undefined, {
            lotId: validatedLotId,
            acquisitionId: originalLot.acquisition_id,
            error: upsertHistoryError,
          });
        }
      } else {
        // If remaining quantity is 0, delete the history entry if it exists
        await supabase
          .from("lot_purchase_history")
          .delete()
          .eq("lot_id", validatedLotId)
          .eq("acquisition_id", originalLot.acquisition_id);
      }
    }

    // Log audit entries for split
    try {
      // Log original lot quantity change
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "split_lot",
        entity_type: "inventory_lot",
        entity_id: validatedLotId,
        old_values: {
          quantity: originalLot.quantity,
        },
        new_values: {
          quantity: newQuantity,
        },
        description: `Split ${validatedSplitQty} from lot (from ${originalLot.quantity} to ${newQuantity})`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });

      // Log new lot creation from split
      if (createdLot?.id) {
        await logAudit({
          user_id: userInfo?.userId || null,
          user_email: userInfo?.userEmail || null,
          action_type: "other", // New lot created from split
          entity_type: "inventory_lot",
          entity_id: createdLot.id,
          old_values: null,
          new_values: {
            quantity: validatedSplitQty,
            card_id: originalLot.card_id,
            condition: validatedCondition || originalLot.condition,
            for_sale: validatedForSale ?? originalLot.for_sale,
            list_price_pence: validatedPrice ?? originalLot.list_price_pence,
          },
          description: `Lot created from split (qty: ${validatedSplitQty})`,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
          user_agent: req.headers.get("user-agent") || null,
        });
      }
    } catch (auditError) {
      // Don't fail the split if audit logging fails
      logger.warn("Failed to log audit entries for lot split", undefined, {
        lotId: validatedLotId,
        error: auditError,
      });
    }

    return NextResponse.json({
      ok: true,
      original_lot: { id: validatedLotId, quantity: newQuantity },
      split_lot: createdLot,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "split_lot",
      metadata: { lotId },
    });
  }
}
