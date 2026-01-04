import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * DELETE /api/catalog/set-translations/[setId]
 * Delete a set translation
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  try {
    const { setId } = await params;
    const supabase = supabaseServer();
    
    const { error } = await supabase
      .from("set_translations")
      .delete()
      .eq("set_id", setId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[API] Error deleting set translation:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to delete set translation",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}


