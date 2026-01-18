export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const logger = createApiLogger(req);

  // Extract lineId outside try block so it's available in catch
  const { lineId } = await params;

  try {
    const supabase = supabaseServer();

    // Fetch all photos for this intake line
    const { data: photos, error } = await supabase
      .from("intake_line_photos")
      .select("*")
      .eq("intake_line_id", lineId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch intake line photos", error, undefined, { lineId });
      return createErrorResponse(
        error.message || "Failed to fetch photos",
        500,
        "FETCH_INTAKE_PHOTOS_FAILED",
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
          intake_line_id: photo.intake_line_id,
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
    return handleApiError(req, error, {
      operation: "get_intake_line_photos",
      metadata: { lineId },
    });
  }
}
