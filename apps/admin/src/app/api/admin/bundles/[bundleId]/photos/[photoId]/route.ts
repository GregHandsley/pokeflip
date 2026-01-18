export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bundleId: string; photoId: string }> }
) {
  const logger = createApiLogger(req);

  // Extract params outside try block so they're available in catch
  const { bundleId, photoId } = await params;

  try {
    const supabase = supabaseServer();

    // Get the photo record to get the object_key
    const { data: photo, error: photoError } = await supabase
      .from("bundle_photos")
      .select("object_key")
      .eq("id", photoId)
      .eq("bundle_id", bundleId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("card-photos")
      .remove([photo.object_key]);

    if (storageError) {
      logger.warn("Failed to delete photo from storage", undefined, {
        bundleId,
        photoId,
        objectKey: photo.object_key,
        error: storageError,
      });
      // Continue to delete the record even if storage deletion fails
    }

    // Delete the photo record
    const { error: deleteError } = await supabase
      .from("bundle_photos")
      .delete()
      .eq("id", photoId)
      .eq("bundle_id", bundleId);

    if (deleteError) {
      logger.error("Failed to delete photo record", deleteError, undefined, {
        bundleId,
        photoId,
      });
      return createErrorResponse(
        deleteError.message || "Failed to delete photo",
        500,
        "DELETE_PHOTO_RECORD_FAILED",
        deleteError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Photo deleted successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "delete_bundle_photo",
      metadata: { bundleId, photoId },
    });
  }
}
