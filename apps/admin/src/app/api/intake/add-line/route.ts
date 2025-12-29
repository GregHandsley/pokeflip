import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAllSets, fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      acquisition_id,
      set_id,
      card_id,
      condition,
      quantity,
      for_sale,
      list_price_pence,
      locale = "en",
    } = body;

    if (!acquisition_id || !set_id || !card_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Ensure set exists in DB (fetch from TCGdx and upsert)
    try {
      const sets = await fetchAllSets(locale);
      const set = sets.find((s) => s.id === set_id);
      if (set) {
        await supabase.from("sets").upsert({
          id: set.id,
          name: set.name,
          series: set.series?.name ?? null,
          release_date: set.releaseDate
            ? set.releaseDate.replaceAll("/", "-").slice(0, 10)
            : null,
          api_payload: set,
        });
      }
    } catch (e) {
      console.error("Error fetching set from TCGdx:", e);
    }

    // Ensure card exists in DB (fetch from TCGdx and upsert)
    try {
      const cards = await fetchCardsForSet(set_id, locale);
      const card = cards.find((c) => c.id === card_id);
      if (card) {
        await supabase.from("cards").upsert({
          id: card.id,
          set_id: set_id,
          number: card.number ?? "",
          name: card.name,
          rarity: card.rarity ?? null,
          api_image_url: card.image ?? null,
          api_payload: card,
        });
      }
    } catch (e) {
      console.error("Error fetching card from TCGdx:", e);
    }

    // Insert intake line
    const { error } = await supabase.from("intake_lines").insert({
      acquisition_id,
      set_id,
      card_id,
      condition,
      quantity,
      for_sale,
      list_price_pence,
      status: "draft",
    } as any);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}

