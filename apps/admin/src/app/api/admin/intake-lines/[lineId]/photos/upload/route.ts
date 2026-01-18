export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { validateImageFile, validateFileKind, getSafeFilename } from "@/lib/file-validation";
import { uuid } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const logger = createApiLogger(req);

  // Extract lineId outside try block so it's available in catch
  const { lineId } = await params;

  try {
    const validatedLineId = uuid(lineId, "lineId");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const kindParam = formData.get("kind") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file kind
    const kind = validateFileKind(kindParam || "", ["front", "back", "extra"]);
    if (!kind) {
      return NextResponse.json(
        { error: "kind must be 'front', 'back', or 'extra'" },
        { status: 400 }
      );
    }

    // Validate image file (type, size, content)
    const fileValidation = await validateImageFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error || "Invalid file" }, { status: 400 });
    }

    // Verify the intake line exists and is in draft status
    const supabase = supabaseServer();
    const { data: line, error: lineError } = await supabase
      .from("intake_lines")
      .select("id, status")
      .eq("id", validatedLineId)
      .single();

    if (lineError || !line) {
      return NextResponse.json({ error: "Intake line not found" }, { status: 404 });
    }

    if (line.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add photos to draft intake lines" },
        { status: 400 }
      );
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
    const safeFilename = getSafeFilename(`${photoId}-${kind}`, "");
    const objectKey = `intake-lines/${validatedLineId}/${safeFilename}.${extension}`;

    // Upload to storage using service role (private bucket)
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("card-photos")
      .upload(objectKey, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Failed to upload intake line photo", uploadError, undefined, {
        lineId,
        objectKey,
        kind,
      });
      return createErrorResponse(
        uploadError.message || "Failed to upload file",
        500,
        "UPLOAD_INTAKE_PHOTO_FAILED",
        uploadError
      );
    }

    // Insert intake_line_photos record
    const { data: photo, error: insertError } = await supabase
      .from("intake_line_photos")
      .insert({
        intake_line_id: validatedLineId,
        kind,
        object_key: objectKey,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert intake_line_photo", insertError, undefined, {
        lineId,
        objectKey,
        kind,
      });
      // Try to clean up uploaded file
      await supabase.storage.from("card-photos").remove([objectKey]);
      return createErrorResponse(
        insertError.message || "Failed to save photo record",
        500,
        "INSERT_INTAKE_PHOTO_FAILED",
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
        intake_line_id: photo.intake_line_id,
        kind: photo.kind,
        object_key: photo.object_key,
        created_at: photo.created_at,
        signedUrl: signedError ? null : signedData?.signedUrl || null,
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "upload_intake_line_photo",
      metadata: { lineId },
    });
  }
}
