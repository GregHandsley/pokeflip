import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAllSets, fetchCardsForSet, fetchCardById } from "@/lib/tcgdx/tcgdxClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      acquisition_id,
      set_id,
      card_id,
      condition,
      variation = "standard",
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

    // Ensure set exists first - always store English version
    const { data: existingSet } = await supabase
      .from("sets")
      .select("id")
      .eq("id", set_id)
      .single();

    if (!existingSet) {
      try {
        // Always fetch English set name, regardless of user's locale selection
        let set = null;
        try {
          const englishSets = await fetchAllSets("en");
          set = englishSets.find((s) => s.id === set_id);
        } catch (e) {
          // If English doesn't exist, fall back to requested locale
          const sets = await fetchAllSets(locale);
          set = sets.find((s) => s.id === set_id);
        }
        
        if (set) {
          const { error: setError } = await supabase.from("sets").upsert({
            id: set.id,
            name: set.name, // English name (or fallback to requested locale)
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
    // Always store English as the base/canonical record (like Cardmarket does)
    if (!existingCard) {
      try {
        // Strategy: Always try to get English version first, regardless of user's locale
        // Card IDs are consistent across languages, so we can fetch English by same ID
        let baseCard = null;
        
        // Method 1: Try direct fetch by card ID in English (fastest)
        baseCard = await fetchCardById(card_id, "en");
        
        // Method 2: If that fails, try fetching English set and finding the card
        if (!baseCard) {
          try {
            const englishCards = await fetchCardsForSet(set_id, "en");
            baseCard = englishCards.find((c) => c.id === card_id) || null;
          } catch (e) {
            // English set might not exist for this set_id, continue
          }
        }
        
        // Method 3: If English doesn't exist, the card might be Japanese-only
        // In this case, we still store it but note that it doesn't have English
        // (This is rare - most cards have English versions)
        if (!baseCard) {
          // Try the requested locale as last resort
          if (locale !== "en") {
            try {
              const cards = await fetchCardsForSet(set_id, locale);
              baseCard = cards.find((c) => c.id === card_id) || null;
            } catch (e) {
              // Set might not exist in requested locale either
            }
          }
        }
        
        if (!baseCard) {
          return NextResponse.json(
            { error: `Card ${card_id} not found` },
            { status: 404 }
          );
        }

        // Store English as canonical (or the card we found if English doesn't exist)
        // TCGdx uses localId for the card number (e.g., "1", "2", "3")
        let cardNumber = baseCard.localId ?? baseCard.number ?? "";
        let { error: cardError } = await supabase.from("cards").insert({
          id: baseCard.id,
          set_id: set_id,
          number: cardNumber,
          name: baseCard.name, // Always store English name (or base name)
          rarity: baseCard.rarity ?? null,
          api_image_url: baseCard.image ?? null,
          api_payload: baseCard,
        });

        // Handle different types of conflicts
        if (cardError) {
          // Check if it's a primary key conflict (card already exists with this ID)
          if (cardError.message.includes("cards_pkey") || cardError.message.includes("duplicate key value violates unique constraint \"cards_pkey\"")) {
            // Card already exists with this ID - that's fine, just proceed
            // The card is already in the database, so we can continue
          }
          // Check if it's a unique constraint on (set_id, number)
          else if (cardError.message.includes("unique constraint") || cardError.message.includes("duplicate key") || cardError.message.includes("cards_set_id_number_key")) {
            // Check if there's a card with the same set_id + number
            const { data: conflictCard } = await supabase
              .from("cards")
              .select("id, name, number")
              .eq("set_id", set_id)
              .eq("number", cardNumber)
              .single();
            
            if (conflictCard) {
              // Different card with same number - make number unique
              // Extract a unique suffix from the card_id (e.g., "015" from "sv08.5-015")
              const cardIdSuffix = baseCard.id.split("-").pop() || baseCard.id.slice(-4);
              cardNumber = `${cardNumber}-${cardIdSuffix}`;

              // Try inserting again with the unique number
              const { error: retryError } = await supabase.from("cards").insert({
                id: baseCard.id,
                set_id: set_id,
                number: cardNumber,
                name: baseCard.name,
                rarity: baseCard.rarity ?? null,
                api_image_url: baseCard.image ?? null,
                api_payload: baseCard,
              });

              if (retryError) {
                // If retry also fails with primary key, card already exists - that's fine
                if (retryError.message.includes("cards_pkey")) {
                  // Card already exists, proceed
                } else {
                  return NextResponse.json(
                    { error: `Failed to save card after conflict resolution: ${retryError.message}` },
                    { status: 500 }
                  );
                }
              }
            } else {
              // Conflict error but no conflict card found - might be primary key issue
              // Check if card exists by ID
              const { data: existingById } = await supabase
                .from("cards")
                .select("id")
                .eq("id", baseCard.id)
                .single();
              
              if (existingById) {
                // Card already exists - that's fine, proceed
              } else {
                return NextResponse.json(
                  { error: `Failed to save card: ${cardError.message}` },
                  { status: 500 }
                );
              }
            }
          } else {
            // Other errors
            return NextResponse.json(
              { error: `Failed to save card: ${cardError.message}` },
              { status: 500 }
            );
          }
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
      .eq("variation", variation || "standard")
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

    // No existing line with same card + condition (+ variation), create a new one
    const { error } = await supabase.from("intake_lines").insert({
      acquisition_id,
      set_id,
      card_id,
      condition,
      variation,
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

