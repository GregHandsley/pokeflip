import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ lotId: string; photoId: string }> }
) {
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
      console.warn("Error deleting from storage:", storageError);
      // Continue to delete the record even if storage deletion fails
    }

    // Delete the photo record
    const { error: deleteError } = await supabase
      .from("lot_photos")
      .delete()
      .eq("id", photoId)
      .eq("lot_id", lotId);

    if (deleteError) {
      console.error("Error deleting photo record:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete photo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Photo deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete photo API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

