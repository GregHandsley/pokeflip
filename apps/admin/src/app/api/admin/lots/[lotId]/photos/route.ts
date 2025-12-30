import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    // Fetch all photos for this lot
    const { data: photos, error } = await supabase
      .from("lot_photos")
      .select("*")
      .eq("lot_id", lotId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching photos:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch photos" },
        { status: 500 }
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
  } catch (error: any) {
    console.error("Error in photos list API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

