import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type BulkAction =
  | { action: "queue_publish"; lotIds: string[] }
  | { action: "update_list_price"; lotIds: string[]; list_price: number }
  | { action: "mark_not_for_sale"; lotIds: string[]; for_sale: boolean };

export async function POST(req: Request) {
  try {
    const body = await req.json() as BulkAction;
    const supabase = supabaseServer();

    if (!body.action || !body.lotIds || body.lotIds.length === 0) {
      return NextResponse.json(
        { error: "Action and lotIds are required" },
        { status: 400 }
      );
    }

    let result: any = { ok: true, message: "", affected: 0 };

    switch (body.action) {
      case "queue_publish": {
        // Check photo requirements before queuing
        const { data: lotsData } = await supabase
          .from("inventory_lots")
          .select(`
            id,
            use_api_image,
            cards!inner(api_image_url)
          `)
          .in("id", body.lotIds);

        // Get photo counts by kind (front/back) for each lot
        const { data: photosData } = await supabase
          .from("lot_photos")
          .select("lot_id, kind")
          .in("lot_id", body.lotIds)
          .in("kind", ["front", "back"]);

        const photoKindsMap = new Map<string, Set<string>>();
        (photosData || []).forEach((photo: any) => {
          if (!photoKindsMap.has(photo.lot_id)) {
            photoKindsMap.set(photo.lot_id, new Set());
          }
          photoKindsMap.get(photo.lot_id)!.add(photo.kind);
        });

        // Filter lots that meet photo requirements
        const eligibleLotIds: string[] = [];
        const missingPhotoLotIds: string[] = [];

        (lotsData || []).forEach((lot: any) => {
          const photoKinds = photoKindsMap.get(lot.id) || new Set();
          const hasFront = photoKinds.has("front");
          const hasBack = photoKinds.has("back");
          const hasRequiredPhotos = hasFront && hasBack;

          if (lot.use_api_image || hasRequiredPhotos) {
            eligibleLotIds.push(lot.id);
          } else {
            missingPhotoLotIds.push(lot.id);
          }
        });

        if (missingPhotoLotIds.length > 0) {
          return NextResponse.json(
            {
              error: `Cannot queue ${missingPhotoLotIds.length} lot(s): Missing required photos (front and back) or API image flag not set`,
              missingPhotoLotIds,
            },
            { status: 400 }
          );
        }

        // Insert publish jobs for lots that don't have active jobs
        const { data: existingJobs } = await supabase
          .from("ebay_publish_jobs")
          .select("lot_id")
          .in("lot_id", eligibleLotIds)
          .in("status", ["queued", "running"]);

        const existingLotIds = new Set((existingJobs || []).map((j: any) => j.lot_id));
        const newLotIds = eligibleLotIds.filter((id) => !existingLotIds.has(id));

        if (newLotIds.length > 0) {
          const jobsToInsert = newLotIds.map((lotId) => ({
            lot_id: lotId,
            status: "queued" as const,
            attempts: 0,
          }));

          const { error: insertError } = await supabase
            .from("ebay_publish_jobs")
            .insert(jobsToInsert);

          if (insertError) {
            throw new Error(insertError.message || "Failed to queue publish jobs");
          }

          // Also update inventory_lots.ebay_publish_queued_at
          const { error: updateError } = await supabase
            .from("inventory_lots")
            .update({ ebay_publish_queued_at: new Date().toISOString() })
            .in("id", newLotIds);

          if (updateError) {
            console.warn("Failed to update ebay_publish_queued_at:", updateError);
          }

          result.affected = newLotIds.length;
          result.message = `Queued ${newLotIds.length} lot(s) for publishing`;
        } else {
          result.message = "All selected lots already have active publish jobs";
        }
        break;
      }

      case "update_list_price": {
        if (body.list_price === undefined || body.list_price === null) {
          return NextResponse.json(
            { error: "list_price is required for update_list_price action" },
            { status: 400 }
          );
        }

        const listPricePence = Math.round(body.list_price * 100);

        const { error: updateError } = await supabase
          .from("inventory_lots")
          .update({ list_price_pence: listPricePence })
          .in("id", body.lotIds);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update list prices");
        }

        result.affected = body.lotIds.length;
        result.message = `Updated list price for ${body.lotIds.length} lot(s)`;
        break;
      }

      case "mark_not_for_sale": {
        const { error: updateError } = await supabase
          .from("inventory_lots")
          .update({ for_sale: body.for_sale })
          .in("id", body.lotIds);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update for_sale status");
        }

        result.affected = body.lotIds.length;
        result.message = `Updated for_sale status for ${body.lotIds.length} lot(s)`;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${(body as any).action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in bulk inbox action:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

