import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { lotId } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const kind = formData.get("kind") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

    // Generate object key
    const photoId = crypto.randomUUID();
    const extension = file.type.includes("webp") ? "webp" : "jpg";
    const objectKey = `lots/${lotId}/${photoId}-${kind}.${extension}`;

    // Upload to storage using service role (private bucket)
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("card-photos")
      .upload(objectKey, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Failed to upload file", uploadError, undefined, { lotId, objectKey, kind });
      return createErrorResponse(
        uploadError.message || "Failed to upload file",
        500,
        "UPLOAD_FILE_FAILED",
        uploadError
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
      logger.error("Failed to insert lot_photo", insertError, undefined, { lotId, objectKey, kind });
      // Try to clean up uploaded file
      await supabase.storage.from("card-photos").remove([objectKey]);
      return createErrorResponse(
        insertError.message || "Failed to save photo record",
        500,
        "INSERT_PHOTO_RECORD_FAILED",
        insertError
      );
    }

    // Generate signed URL for immediate preview (15 minute expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("card-photos")
      .createSignedUrl(objectKey, 900); // 15 minutes

    return NextResponse.json({
      ok: true,
      photo: {
        id: photo.id,
        lot_id: photo.lot_id,
        kind: photo.kind,
        object_key: photo.object_key,
        created_at: photo.created_at,
        signedUrl: signedError ? null : signedData?.signedUrl || null,
      },
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "upload_lot_photo", metadata: { lotId } });
  }
}

