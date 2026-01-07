import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ lotId: string; photoId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { lotId, photoId } = await params;
    const supabase = supabaseServer();

    // Get the photo record to get the object_key
    const { data: photo, error: photoError } = await supabase
      .from("lot_photos")
      .select("object_key")
      .eq("id", photoId)
      .eq("lot_id", lotId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("card-photos")
      .remove([photo.object_key]);

    if (storageError) {
      logger.warn("Failed to delete photo from storage", storageError, undefined, {
        lotId,
        photoId,
        objectKey: photo.object_key,
      });
      // Continue to delete the record even if storage deletion fails
    }

    // Delete the photo record
    const { error: deleteError } = await supabase
      .from("lot_photos")
      .delete()
      .eq("id", photoId)
      .eq("lot_id", lotId);

    if (deleteError) {
      logger.error("Failed to delete photo record", deleteError, undefined, { lotId, photoId });
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
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "delete_lot_photo",
      metadata: { lotId, photoId },
    });
  }
}

