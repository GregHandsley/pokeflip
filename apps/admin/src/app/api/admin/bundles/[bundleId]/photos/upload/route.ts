import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { bundleId } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const kind = formData.get("kind") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Verify the bundle exists
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select("id")
      .eq("id", bundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Generate object key
    const photoId = crypto.randomUUID();
    const extension = file.type.includes("webp") ? "webp" : "jpg";
    const objectKey = `bundles/${bundleId}/${photoId}.${extension}`;

    // Upload to storage using service role (private bucket)
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("card-photos")
      .upload(objectKey, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Failed to upload bundle photo", uploadError, undefined, {
        bundleId,
        fileName: file.name,
        fileSize: file.size,
      });
      return createErrorResponse(
        uploadError.message || "Failed to upload file",
        500,
        "UPLOAD_PHOTO_FAILED",
        uploadError
      );
    }

    // Insert bundle_photos record (kind defaults to 'bundle')
    const { data: photo, error: insertError } = await supabase
      .from("bundle_photos")
      .insert({
        bundle_id: bundleId,
        kind: "bundle",
        object_key: objectKey,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert bundle photo record", insertError, undefined, {
        bundleId,
        objectKey,
      });
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
        bundle_id: photo.bundle_id,
        kind: photo.kind,
        object_key: photo.object_key,
        created_at: photo.created_at,
        signedUrl: signedError ? null : signedData?.signedUrl || null,
      },
    });
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "upload_bundle_photo",
      metadata: { bundleId },
    });
  }
}

