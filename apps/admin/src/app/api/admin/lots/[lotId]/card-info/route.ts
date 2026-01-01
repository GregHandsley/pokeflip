import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select(
        `
        card_id,
        cards:card_id (
          id,
          number,
          name,
          sets:set_id (
            id,
            name
          )
        )
      `
      )
      .eq("id", lotId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      );
    }

    const card = lot.cards as any;
    const set = card?.sets as any;

    return NextResponse.json({
      ok: true,
      card: {
        number: card?.number || "",
        name: card?.name || "",
        set: set ? { name: set.name } : null,
      },
    });
  } catch (error: any) {
    console.error("Error in card-info API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

