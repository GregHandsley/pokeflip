import type { Condition } from "./types";
import { poundsToPence } from "@pokeflip/shared";

type Args = {
  acquisitionId: string;
  setId: string;
  cardId: string;
  locale: string;
  quantity: number;
  defaults: {
    condition: Condition;
    variation?: string;
    forSale: boolean;
    listPricePounds?: string | null; // optional; if blank/null, do not set
  };
};

/**
 * Insert a draft intake line via API route.
 * The API route ensures the card and set exist in the database first.
 */
export async function insertDraftLine({
  acquisitionId,
  setId,
  cardId,
  locale,
  quantity,
  defaults,
}: Args) {
  const hasPrice =
    defaults.forSale && defaults.listPricePounds && defaults.listPricePounds.trim() !== "";
  const res = await fetch("/api/intake/add-line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      acquisition_id: acquisitionId,
      set_id: setId,
      card_id: cardId,
      condition: defaults.condition,
      variation: defaults.variation || "standard",
      quantity,
      for_sale: defaults.forSale,
      list_price_pence: hasPrice ? poundsToPence(defaults.listPricePounds!) : null,
      locale,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    return { error: { message: json.error || "Failed to add card" } };
  }

  return { error: null };
}
