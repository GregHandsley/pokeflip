import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  try {
    const { lineId } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const kind = formData.get("kind") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!kind || !["front", "back", "extra"].includes(kind)) {
      return NextResponse.json(
        { error: "kind must be 'front', 'back', or 'extra'" },
        { status: 400 }
      );
    }

    // Verify the intake line exists and is in draft status
    const supabase = supabaseServer();
    const { data: line, error: lineError } = await supabase
      .from("intake_lines")
      .select("id, status")
      .eq("id", lineId)
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

    // Generate object key
    const photoId = crypto.randomUUID();
    const extension = file.type.includes("webp") ? "webp" : "jpg";
    const objectKey = `intake-lines/${lineId}/${photoId}-${kind}.${extension}`;

    // Upload to storage using service role (private bucket)
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("card-photos")
      .upload(objectKey, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload file" },
        { status: 500 }
      );
    }

    // Insert intake_line_photos record
    const { data: photo, error: insertError } = await supabase
      .from("intake_line_photos")
      .insert({
        intake_line_id: lineId,
        kind,
        object_key: objectKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting intake_line_photo:", insertError);
      // Try to clean up uploaded file
      await supabase.storage.from("card-photos").remove([objectKey]);
      return NextResponse.json(
        { error: insertError.message || "Failed to save photo record" },
        { status: 500 }
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
  } catch (error: any) {
    console.error("Error in upload API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

