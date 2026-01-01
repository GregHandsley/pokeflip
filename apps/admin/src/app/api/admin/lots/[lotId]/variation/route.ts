import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const ALLOWED_VARIATIONS = [
  "standard",
  "holo",
  "reverse_holo",
  "first_edition",
  "master_ball",
  "stamped",
  "promo",
  "shadowless",
  "non_holo",
];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const body = await req.json();
    const variation = (body?.variation as string | undefined)?.trim() || "standard";

    if (!ALLOWED_VARIATIONS.includes(variation)) {
      return NextResponse.json(
        { error: "Invalid variation" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const { error } = await supabase
      .from("inventory_lots")
      .update({ variation })
      .eq("id", lotId);

    if (error) {
      console.error("Update variation error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update variation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, variation });
  } catch (error: unknown) {
    console.error("Error updating variation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

