export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const logger = createApiLogger(req);

  // Extract bundleId outside try block so it's available in catch
  const { bundleId } = await params;

  try {
    const supabase = supabaseServer();

    const { data: photos, error } = await supabase
      .from("bundle_photos")
      .select("id, kind, object_key, created_at")
      .eq("bundle_id", bundleId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch bundle photos", error, undefined, { bundleId });
      return createErrorResponse(
        error.message || "Failed to fetch photos",
        500,
        "FETCH_BUNDLE_PHOTOS_FAILED",
        error
      );
    }

    // Generate signed URLs for all photos (15 minute expiry)
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data: signedData } = await supabase.storage
          .from("card-photos")
          .createSignedUrl(photo.object_key, 900); // 15 minutes

        return {
          id: photo.id,
          kind: photo.kind,
          object_key: photo.object_key,
          created_at: photo.created_at,
          signedUrl: signedData?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      photos: photosWithUrls,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_bundle_photos", metadata: { bundleId } });
  }
}
