import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function POST(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);

  // Extract lotId outside try block so it's available in catch
  const { lotId } = await params;

  try {
    const body = await req.json();
    const { objectKey, kind } = body as {
      objectKey?: string;
      kind?: "front" | "back" | "extra";
    };

    if (!objectKey) {
      return NextResponse.json({ error: "objectKey is required" }, { status: 400 });
    }

    if (!kind || !["front", "back", "extra"].includes(kind)) {
      return NextResponse.json(
        { error: "kind must be 'front', 'back', or 'extra'" },
        { status: 400 }
      );
    }

    // Verify the lot exists
    const supabase = supabaseServer();
    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("id", lotId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Verify the file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from("card-photos")
      .list(`lots/${lotId}`, {
        search: objectKey.split("/").pop(),
      });

    if (fileError || !fileData || fileData.length === 0) {
      return NextResponse.json(
        { error: "File not found in storage. Upload may have failed." },
        { status: 400 }
      );
    }

    // Insert lot_photos record
    const { data: photo, error: insertError } = await supabase
      .from("lot_photos")
      .insert({
        lot_id: lotId,
        kind,
        object_key: objectKey,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert lot_photo", insertError, undefined, {
        lotId,
        objectKey,
        kind,
      });
      return createErrorResponse(
        insertError.message || "Failed to save photo record",
        500,
        "INSERT_LOT_PHOTO_FAILED",
        insertError
      );
    }

    return NextResponse.json({
      ok: true,
      photo: {
        id: photo.id,
        lot_id: photo.lot_id,
        kind: photo.kind,
        object_key: photo.object_key,
        created_at: photo.created_at,
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "commit_lot_photo", metadata: { lotId } });
  }
}
