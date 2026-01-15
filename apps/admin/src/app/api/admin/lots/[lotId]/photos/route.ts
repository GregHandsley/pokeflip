import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);
  const { lotId } = await params;

  try {
    const supabase = supabaseServer();

    // Fetch all photos for this lot
    const { data: photos, error } = await supabase
      .from("lot_photos")
      .select("*")
      .eq("lot_id", lotId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch photos", error, undefined, { lotId });
      return createErrorResponse(
        error.message || "Failed to fetch photos",
        500,
        "FETCH_PHOTOS_FAILED",
        error
      );
    }

    // Generate signed URLs for preview (15 minute expiry)
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("card-photos")
          .createSignedUrl(photo.object_key, 900); // 15 minutes

        return {
          id: photo.id,
          lot_id: photo.lot_id,
          kind: photo.kind,
          object_key: photo.object_key,
          created_at: photo.created_at,
          signedUrl: signedError ? null : signedData?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      photos: photosWithUrls,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_lot_photos", metadata: { lotId } });
  }
}
