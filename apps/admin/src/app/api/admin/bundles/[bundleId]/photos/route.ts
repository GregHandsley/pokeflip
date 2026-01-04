import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  try {
    const { bundleId } = await params;
    const supabase = supabaseServer();

    const { data: photos, error } = await supabase
      .from("bundle_photos")
      .select("id, kind, object_key, created_at")
      .eq("bundle_id", bundleId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching bundle photos:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch photos" },
        { status: 500 }
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
  } catch (error: any) {
    console.error("Error in bundle photos API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
