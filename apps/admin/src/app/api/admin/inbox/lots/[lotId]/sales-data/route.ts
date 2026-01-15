import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { variationLabel } from "@/components/inventory/variations";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type SetRow = {
  id: string;
  name: string;
};

type CardWithSet = {
  id: string;
  number: string | null;
  name: string | null;
  rarity: string | null;
  set_id: string | null;
  sets: SetRow | SetRow[] | null;
};

export async function GET(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);

  // Extract lotId outside try block so it's available in catch
  const { lotId } = await params;

  try {
    const supabase = supabaseServer();

    // Fetch the lot
    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select("*")
      .eq("id", lotId)
      .single();

    if (lotError || !lot) {
      logger.error("Failed to fetch lot", lotError, undefined, { lotId });
      return createErrorResponse("Lot not found", 404, "LOT_NOT_FOUND", lotError);
    }

    // Fetch the card
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(
        `
        id,
        number,
        name,
        rarity,
        set_id,
        sets (
          id,
          name
        )
      `
      )
      .eq("id", lot.card_id)
      .single();

    if (cardError || !card) {
      logger.error("Failed to fetch card", cardError, undefined, { lotId, cardId: lot.card_id });
      return createErrorResponse("Card not found", 404, "CARD_NOT_FOUND", cardError);
    }

    const cardData = card as CardWithSet;
    const sets = Array.isArray(cardData.sets) ? cardData.sets[0] : cardData.sets;
    const set = sets || null;
    const conditionLabel =
      CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition;
    const variation = variationLabel(lot.variation || "standard");

    // Generate title: "Pokemon card [Card Name] [Set Name] [Number/Total] [Variation] [Condition]"
    // Format: "Pokemon card {name} {set} {number} {variation} {condition}"
    // Remove leading zeros from card number
    const cardNumber = cardData.number?.replace(/^0+/, "") || cardData.number || "";
    const setTotal = set?.name || "";

    // Build title parts
    const titleParts: string[] = ["Pokemon card"];

    if (card.name) {
      titleParts.push(card.name);
    }

    if (setTotal) {
      titleParts.push(setTotal);
    }

    if (cardNumber) {
      titleParts.push(cardNumber);
    }

    if (variation && variation !== "Standard") {
      titleParts.push(variation);
    }

    if (conditionLabel) {
      titleParts.push(conditionLabel);
    }

    const title = titleParts.join(" ").trim();

    // Ensure title is under 80 characters (eBay limit)
    const maxTitleLength = 80;
    const finalTitle =
      title.length > maxTitleLength ? title.substring(0, maxTitleLength).trim() : title;

    // Generate description
    const descriptionParts: string[] = [];

    if (card.name) {
      descriptionParts.push(card.name);
    }

    if (setTotal) {
      descriptionParts.push(`Set: ${setTotal}`);
    }

    if (cardNumber) {
      descriptionParts.push(`Card No: ${cardNumber}`);
    }

    if (card.rarity) {
      descriptionParts.push(`Rarity: ${card.rarity}`);
    }

    if (conditionLabel) {
      descriptionParts.push(`Condition: ${conditionLabel}`);
    }

    if (variation && variation !== "Standard") {
      descriptionParts.push(`Variation: ${variation}`);
    }

    descriptionParts.push("");
    descriptionParts.push("Photos show the exact card(s) you will receive.");
    descriptionParts.push("Packed securely and dispatched promptly.");

    // Add multi-card discount note if quantity > 1
    if (lot.quantity > 1) {
      descriptionParts.push("");
      descriptionParts.push(
        `Multiple cards available. Discounts available for multiple purchases.`
      );
    }

    const description = descriptionParts.join("\n");

    // Get suggested price from list_price_pence or market price
    let suggestedPrice: number | null = lot.list_price_pence || null;

    // If no list price, try to get market price
    if (!suggestedPrice) {
      try {
        const origin =
          req.headers.get("origin") || req.headers.get("host")
            ? `http://${req.headers.get("host")}`
            : "http://localhost:3000";
        const marketRes = await fetch(`${origin}/api/admin/market/prices/${card.id}`, {
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (marketRes.ok) {
          const marketJson = await marketRes.json();
          if (marketJson?.chosen?.price_pence) {
            suggestedPrice = marketJson.chosen.price_pence;
          }
        }
      } catch (e) {
        // Ignore market price fetch errors
        console.warn("Failed to fetch market price:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        title: finalTitle,
        description,
        suggestedPrice,
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_sales_data", metadata: { lotId } });
  }
}
