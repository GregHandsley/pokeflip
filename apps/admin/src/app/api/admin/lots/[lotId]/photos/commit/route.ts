import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { objectKey, kind } = body as {
      objectKey?: string;
      kind?: "front" | "back" | "extra";
    };

    if (!objectKey) {
      return NextResponse.json(
        { error: "objectKey is required" },
        { status: 400 }
      );
    }

    if (!kind || !["front", "back", "extra"].includes(kind)) {
      return NextResponse.json(
        { error: "kind must be 'front', 'back', or 'extra'" },
        { status: 400 }
      );
    }

    // Verify the lot exists
    const supabase = supabaseServer();
    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("id", lotId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      );
    }

    // Verify the file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from("card-photos")
      .list(`lots/${lotId}`, {
        search: objectKey.split("/").pop(),
      });

    if (fileError || !fileData || fileData.length === 0) {
      return NextResponse.json(
        { error: "File not found in storage. Upload may have failed." },
        { status: 400 }
      );
    }

    // Insert lot_photos record
    const { data: photo, error: insertError } = await supabase
      .from("lot_photos")
      .insert({
        lot_id: lotId,
        kind,
        object_key: objectKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting lot_photo:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to save photo record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      photo: {
        id: photo.id,
        lot_id: photo.lot_id,
        kind: photo.kind,
        object_key: photo.object_key,
        created_at: photo.created_at,
      },
    });
  } catch (error: any) {
    console.error("Error in commit photo API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

