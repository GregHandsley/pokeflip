import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

type SetRow = {
  id: string;
  name: string;
};

type CardRow = {
  id: string;
  number: string;
  name: string;
  sets: SetRow | SetRow[] | null;
};

export async function GET(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  // Extract lotId outside try block so it's available in catch
  const { lotId } = await params;

  try {
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
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Handle Supabase relation which may return array or single object
    const cardsData = Array.isArray(lot.cards) ? lot.cards[0] : lot.cards;
    const card = cardsData as CardRow | null;
    const setsData = Array.isArray(card?.sets) ? card.sets[0] : card?.sets;
    const set = setsData as SetRow | null;

    return NextResponse.json({
      ok: true,
      card: {
        number: card?.number || "",
        name: card?.name || "",
        set: set ? { name: set.name } : null,
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_card_info", metadata: { lotId } });
  }
}
