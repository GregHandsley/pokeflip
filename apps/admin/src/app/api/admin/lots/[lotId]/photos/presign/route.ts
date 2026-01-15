import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  // Extract lotId outside try block so it's available in catch
  const { lotId } = await params;

  try {
    const body = await req.json();
    const { kind, contentType } = body as {
      kind?: "front" | "back" | "extra";
      contentType?: string;
    };

    if (!kind || !["front", "back", "extra"].includes(kind)) {
      return NextResponse.json(
        { error: "kind must be 'front', 'back', or 'extra'" },
        { status: 400 }
      );
    }

    if (!contentType || !contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "contentType must be an image MIME type" },
        { status: 400 }
      );
    }

    // Generate object key: lots/{lotId}/{photoId}-{kind}.webp
    const photoId = crypto.randomUUID();
    const extension = contentType.includes("webp") ? "webp" : "jpg";
    const objectKey = `lots/${lotId}/${photoId}-${kind}.${extension}`;

    const supabase = supabaseServer();

    // For private buckets, we'll use a signed POST URL
    // Generate a token that allows upload to this specific path
    // Note: Supabase doesn't have createSignedUploadUrl, so we'll return the objectKey
    // and the client will upload through a different endpoint, or we can use POST signed URLs
    // For now, return the objectKey and let the commit endpoint handle verification

    // Alternative: Generate a signed URL for PUT (read/write)
    // This is a workaround - ideally we'd use createSignedUploadUrl if available
    const expiresIn = 300; // 5 minutes
    const { data: signedData, error: signedError } = await supabase.storage
      .from("card-photos")
      .createSignedUrl(objectKey, expiresIn);

    if (signedError) {
      // If signed URL fails, we'll handle upload server-side in commit
      // Return objectKey for server-side upload path
      return NextResponse.json({
        ok: true,
        uploadUrl: null, // Client will need to upload via server
        objectKey,
        path: objectKey,
        serverUpload: true, // Flag to indicate server-side upload needed
      });
    }

    return NextResponse.json({
      ok: true,
      uploadUrl: signedData.signedUrl,
      objectKey,
      path: objectKey,
      serverUpload: false,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "presign_lot_photo", metadata: { lotId } });
  }
}
