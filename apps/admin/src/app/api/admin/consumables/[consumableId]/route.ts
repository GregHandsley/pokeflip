import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ consumableId: string }> }
) {
  try {
    const { consumableId } = await params;
    const body = await req.json();
    const { name, unit } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: consumable, error } = await supabase
      .from("consumables")
      .update({
        name: name.trim(),
        unit: (unit || "each").trim(),
      })
      .eq("id", consumableId)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating consumable:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update consumable" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      consumable,
    });
  } catch (error: any) {
    console.error("Error in update consumable API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

