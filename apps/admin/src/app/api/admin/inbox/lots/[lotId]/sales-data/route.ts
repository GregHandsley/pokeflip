import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const supabase = supabaseServer();

    // Fetch lot with card and set information
    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select(
        `
        id,
        condition,
        quantity,
        list_price_pence,
        cards:card_id (
          id,
          number,
          name,
          rarity,
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

    // Enrich with TCGdex data for number/total/rarity where possible
    let tcgdexCard: any = null;
    try {
      const tcgRes = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(card?.id || "")}`);
      if (tcgRes.ok) {
        tcgdexCard = await tcgRes.json();
      }
    } catch (e) {
      console.warn("TCGdex fetch failed, using DB fields only", e);
    }

    // Calculate available quantity (quantity minus sold)
    const { data: salesItems } = await supabase
      .from("sales_items")
      .select("qty")
      .eq("lot_id", lotId);

    const soldQty = salesItems?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
    const availableQty = lot.quantity - soldQty;

    // Condition label mapping (matches frontend CONDITION_LABELS)
    const conditionLabels: Record<string, string> = {
      NM: "Near Mint",
      LP: "Lightly Played",
      MP: "Moderately Played",
      HP: "Heavily Played",
      DMG: "Damaged",
    };
    const conditionLabel = conditionLabels[lot.condition] || lot.condition;

    // Build better title: "{Name} - {Num}/{Total} {Rarity} - {Set} - Pokemon TCG {Condition}"
    const name = tcgdexCard?.name || card?.name || "Pokemon TCG Card";
    const rawNumber = tcgdexCard?.localId || card?.number || "";
    const setTotal = tcgdexCard?.set?.cardCount?.total;
    const number = rawNumber ? String(rawNumber) : "";
    const rarity = tcgdexCard?.rarity || card?.rarity || "";
    const setName = tcgdexCard?.set?.name || set?.name || "Set";

    let titleParts = [name];
    if (number) {
      titleParts.push(setTotal ? `${number}/${setTotal}` : number);
    }
    if (rarity) {
      titleParts.push(rarity);
    }
    titleParts.push(setName);
    titleParts.push(`Pokemon TCG ${conditionLabel}`);

    const rawTitle = titleParts.join(" - ");
    const title = rawTitle.length > 80 ? rawTitle.slice(0, 80) : rawTitle;

    // Generate description (configurable template - placeholder for settings)
    // Default template includes card info, condition, and quantity
    const description = `Pokemon Trading Card Game

Card: ${card?.name || "N/A"} #${card?.number || "N/A"}
Set: ${set?.name || "N/A"}
Condition: ${conditionLabel} (${lot.condition})
Quantity Available: ${availableQty}
${card?.rarity ? `Rarity: ${card.rarity}` : ""}

Please review the photos carefully for condition details. All cards are authentic Pokemon TCG cards.

Thank you for looking!`;

    // Pricing suggestion (placeholder for future update)
    const suggestedPrice = lot.list_price_pence;

    return NextResponse.json({
      ok: true,
      data: {
        title,
        description,
        suggestedPrice,
      },
    });
  } catch (error: any) {
    console.error("Error in sales data API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

