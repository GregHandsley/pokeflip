import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type BulkAction =
  | { action: "update_list_price"; lotIds: string[]; list_price: number }
  | { action: "mark_not_for_sale"; lotIds: string[]; for_sale: boolean }
  | { action: "group_lots"; lotIds: string[] };

type BulkActionResult = {
  ok: true;
  message: string;
  affected: number;
  newLotId?: string;
};

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  let body: unknown;

  try {
    body = (await req.json()) as BulkAction;
    const validatedBody = body as BulkAction;
    const supabase = supabaseServer();

    if (!validatedBody.action || !validatedBody.lotIds || validatedBody.lotIds.length === 0) {
      return NextResponse.json({ error: "Action and lotIds are required" }, { status: 400 });
    }

    const result: BulkActionResult = { ok: true, message: "", affected: 0 };

    switch (validatedBody.action) {
      case "update_list_price": {
        if (validatedBody.list_price === undefined || validatedBody.list_price === null) {
          return NextResponse.json(
            { error: "list_price is required for update_list_price action" },
            { status: 400 }
          );
        }

        const listPricePence = Math.round(validatedBody.list_price * 100);

        const { error: updateError } = await supabase
          .from("inventory_lots")
          .update({ list_price_pence: listPricePence })
          .in("id", validatedBody.lotIds);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update list prices");
        }

        result.affected = validatedBody.lotIds.length;
        result.message = `Updated list price for ${validatedBody.lotIds.length} lot(s)`;
        break;
      }

      case "mark_not_for_sale": {
        const { error: updateError } = await supabase
          .from("inventory_lots")
          .update({ for_sale: validatedBody.for_sale })
          .in("id", validatedBody.lotIds);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update for_sale status");
        }

        result.affected = validatedBody.lotIds.length;
        result.message = `Updated for_sale status for ${validatedBody.lotIds.length} lot(s)`;
        break;
      }

      case "group_lots": {
        if (validatedBody.lotIds.length < 2) {
          return NextResponse.json(
            { error: "At least 2 lots are required to group" },
            { status: 400 }
          );
        }

        // Fetch all lots to validate they can be grouped
        const { data: lots, error: fetchError } = await supabase
          .from("inventory_lots")
          .select(
            "id, card_id, condition, quantity, for_sale, list_price_pence, status, note, acquisition_id, use_api_image"
          )
          .in("id", validatedBody.lotIds);

        if (fetchError || !lots || lots.length === 0) {
          throw new Error(fetchError?.message || "Failed to fetch lots");
        }

        if (lots.length !== validatedBody.lotIds.length) {
          throw new Error("Some lots were not found");
        }

        // Validate all lots can be grouped (same card_id, condition, for_sale, list_price_pence)
        const firstLot = lots[0];
        const canGroup = lots.every(
          (lot) =>
            lot.card_id === firstLot.card_id &&
            lot.condition === firstLot.condition &&
            lot.for_sale === firstLot.for_sale &&
            lot.list_price_pence === firstLot.list_price_pence &&
            lot.status !== "sold" &&
            lot.status !== "archived"
        );

        if (!canGroup) {
          return NextResponse.json(
            {
              error:
                "All selected lots must have the same card, condition, price, and for_sale status. Sold or archived lots cannot be grouped.",
            },
            { status: 400 }
          );
        }

        // Calculate combined quantity
        const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);

        // Create new grouped lot
        const { data: newLot, error: createError } = await supabase
          .from("inventory_lots")
          .insert({
            card_id: firstLot.card_id,
            condition: firstLot.condition,
            quantity: totalQuantity,
            for_sale: firstLot.for_sale,
            list_price_pence: firstLot.list_price_pence,
            status: firstLot.status === "draft" ? "draft" : "ready",
            note: firstLot.note || null,
            acquisition_id: firstLot.acquisition_id || null,
            use_api_image: firstLot.use_api_image || false,
          })
          .select("id")
          .single();

        if (createError || !newLot) {
          throw new Error(createError?.message || "Failed to create grouped lot");
        }

        // Transfer photos from all source lots to the new lot
        // Get all photos from source lots
        const { data: allPhotos, error: photosError } = await supabase
          .from("lot_photos")
          .select("kind, object_key")
          .in("lot_id", validatedBody.lotIds);

        if (photosError) {
          logger.warn("Failed to fetch photos during bulk group", undefined, {
            lotIds: validatedBody.lotIds,
            error: photosError,
          });
          // Continue even if photos fail - we'll still group the lots
        } else if (allPhotos && allPhotos.length > 0) {
          // Group photos by kind and deduplicate
          // For front and back, only keep one photo (first one found)
          // For extra photos, keep all unique ones
          const photosByKind = new Map<string, { kind: string; object_key: string }>();
          const extraPhotos: { kind: string; object_key: string }[] = [];

          for (const photo of allPhotos) {
            if (photo.kind === "front" || photo.kind === "back") {
              // Only keep first front/back photo
              if (!photosByKind.has(photo.kind)) {
                photosByKind.set(photo.kind, photo);
              }
            } else if (photo.kind === "extra") {
              // Keep all unique extra photos
              const key = photo.object_key;
              if (!extraPhotos.some((p) => p.object_key === key)) {
                extraPhotos.push(photo);
              }
            }
          }

          // Combine front/back photos with extra photos
          const photosToInsert = [...Array.from(photosByKind.values()), ...extraPhotos].map(
            (photo) => ({
              lot_id: newLot.id,
              kind: photo.kind,
              object_key: photo.object_key,
            })
          );

          if (photosToInsert.length > 0) {
            const { error: insertPhotosError } = await supabase
              .from("lot_photos")
              .insert(photosToInsert);

            if (insertPhotosError) {
              logger.warn("Failed to transfer photos during bulk group", undefined, {
                lotIds: validatedBody.lotIds,
                photosCount: photosToInsert.length,
                error: insertPhotosError,
              });
              // Continue even if photos fail - we'll still group the lots
            }
          }
        }

        // Delete the original lots (this will cascade delete their photos via foreign key)
        const { error: deleteError } = await supabase
          .from("inventory_lots")
          .delete()
          .in("id", validatedBody.lotIds);

        if (deleteError) {
          // If deletion fails, try to delete the new lot we created
          await supabase.from("inventory_lots").delete().eq("id", newLot.id);
          throw new Error(deleteError.message || "Failed to delete original lots");
        }

        result.affected = validatedBody.lotIds.length;
        result.message = `Grouped ${validatedBody.lotIds.length} lot(s) into 1 lot with quantity ${totalQuantity}`;
        result.newLotId = newLot.id;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${(body as BulkAction)?.action ?? "unknown"}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "bulk_inbox_action",
      metadata: { action: (body as BulkAction)?.action },
    });
  }
}
