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

    // Ensure set exists first
    const { data: existingSet } = await supabase
      .from("sets")
      .select("id")
      .eq("id", set_id)
      .single();

    if (!existingSet) {
      try {
        const sets = await fetchAllSets(locale);
        const set = sets.find((s) => s.id === set_id);
        if (set) {
          const { error: setError } = await supabase.from("sets").upsert({
            id: set.id,
            name: set.name,
            series: set.series?.name ?? null,
            release_date: set.releaseDate
              ? set.releaseDate.replaceAll("/", "-").slice(0, 10)
              : null,
            api_payload: set,
          });
          if (setError) {
            return NextResponse.json(
              { error: `Failed to save set: ${setError.message}` },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { error: `Set ${set_id} not found in TCGdx` },
            { status: 404 }
          );
        }
      } catch (e: any) {
        return NextResponse.json(
          { error: `Failed to fetch set from TCGdx: ${e.message}` },
          { status: 500 }
        );
      }
    }

    // Check if card already exists in DB by ID
    const { data: existingCard } = await supabase
      .from("cards")
      .select("id")
      .eq("id", card_id)
      .single();

    // If card doesn't exist, fetch from TCGdx and insert it
    if (!existingCard) {
      try {
        // Fetch the specific card from TCGdx
        const cards = await fetchCardsForSet(set_id, locale);
        const card = cards.find((c) => c.id === card_id);
        
        if (!card) {
          return NextResponse.json(
            { error: `Card ${card_id} not found in set ${set_id}` },
            { status: 404 }
          );
        }

        // Try to insert the card with the original number
        let cardNumber = card.number ?? "";
        let { error: cardError } = await supabase.from("cards").insert({
          id: card.id,
          set_id: set_id,
          number: cardNumber,
          name: card.name,
          rarity: card.rarity ?? null,
          api_image_url: card.image ?? null,
          api_payload: card,
        });

        // If insert fails due to unique constraint on (set_id, number), 
        // handle the conflict by making the number unique
        if (cardError && (cardError.message.includes("unique constraint") || cardError.message.includes("duplicate key"))) {
          // Check if there's a card with the same set_id + number
          const { data: conflictCard } = await supabase
            .from("cards")
            .select("id, name, number")
            .eq("set_id", set_id)
            .eq("number", cardNumber)
            .single();
          
          if (conflictCard) {
            // Check if it's the same card (same name) - if so, use the existing card
            if (conflictCard.name === card.name) {
              // Same card, just use the existing one - don't insert, just proceed with the existing card_id
              // But wait, we need to use the requested card_id, not the conflict card's ID
              // Actually, if it's the same card with different ID, we should use the existing one
              // to maintain data consistency. But the user selected a specific card_id...
              // For now, let's make the number unique by appending the card_id suffix
              const cardIdSuffix = card.id.split("-").pop() || card.id.slice(-4);
              cardNumber = `${cardNumber}-${cardIdSuffix}`;
            } else {
              // Different card with same number - make number unique
              // Extract a unique suffix from the card_id (e.g., "015" from "sv08.5-015")
              const cardIdSuffix = card.id.split("-").pop() || card.id.slice(-4);
              cardNumber = `${cardNumber}-${cardIdSuffix}`;
            }

            // Try inserting again with the unique number
            const { error: retryError } = await supabase.from("cards").insert({
              id: card.id,
              set_id: set_id,
              number: cardNumber,
              name: card.name,
              rarity: card.rarity ?? null,
              api_image_url: card.image ?? null,
              api_payload: card,
            });

            if (retryError) {
              return NextResponse.json(
                { error: `Failed to save card after conflict resolution: ${retryError.message}` },
                { status: 500 }
              );
            }
          } else {
            // Conflict error but no conflict card found - strange, return the error
            return NextResponse.json(
              { error: `Failed to save card: ${cardError.message}` },
              { status: 500 }
            );
          }
        } else if (cardError) {
          // Other errors
          return NextResponse.json(
            { error: `Failed to save card: ${cardError.message}` },
            { status: 500 }
          );
        }
      } catch (e: any) {
        return NextResponse.json(
          { error: `Failed to fetch card from TCGdx: ${e.message}` },
          { status: 500 }
        );
      }
    }

    // Check if there's already a draft line with the same card_id and condition
    const { data: existingLine } = await supabase
      .from("intake_lines")
      .select("id, quantity")
      .eq("acquisition_id", acquisition_id)
      .eq("card_id", card_id)
      .eq("condition", condition)
      .eq("status", "draft")
      .single();

    if (existingLine) {
      // Increment quantity of existing line
      const { error: updateError } = await supabase
        .from("intake_lines")
        .update({ quantity: existingLine.quantity + quantity })
        .eq("id", existingLine.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, updated: true });
    }

    // No existing line with same card + condition, create a new one
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

    return NextResponse.json({ ok: true, created: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}

