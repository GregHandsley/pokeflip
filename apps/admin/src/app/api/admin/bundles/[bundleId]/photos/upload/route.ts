export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { validateImageFile, getSafeFilename } from "@/lib/file-validation";
import { uuid } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const logger = createApiLogger(req);

  // Extract bundleId outside try block so it's available in catch
  const { bundleId } = await params;

  try {
    const validatedBundleId = uuid(bundleId, "bundleId");

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate image file (type, size, content)
    const fileValidation = await validateImageFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error || "Invalid file" }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Verify the bundle exists
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select("id")
      .eq("id", validatedBundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Generate object key with safe filename
    const photoId = crypto.randomUUID();
    const extension = file.type.includes("webp")
      ? "webp"
      : file.type.includes("png")
        ? "png"
        : file.type.includes("gif")
          ? "gif"
          : "jpg";
    const safeFilename = getSafeFilename(photoId, "");
    const objectKey = `bundles/${validatedBundleId}/${safeFilename}.${extension}`;

    // Upload to storage using service role (private bucket)
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("card-photos")
      .upload(objectKey, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Failed to upload bundle photo", uploadError, undefined, {
        bundleId: validatedBundleId,
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
        bundle_id: validatedBundleId,
        kind: "bundle",
        object_key: objectKey,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert bundle photo record", insertError, undefined, {
        bundleId: validatedBundleId,
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
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "upload_bundle_photo",
      metadata: { bundleId },
    });
  }
}
