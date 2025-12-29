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
    forSale: boolean;
    listPricePounds: string; // e.g. "0.99"
  };
};

/**
 * Insert a draft intake line via API route.
 * The API route ensures the card and set exist in the database first.
 */
export async function insertDraftLine({ acquisitionId, setId, cardId, locale, quantity, defaults }: Args) {
  const res = await fetch("/api/intake/add-line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      acquisition_id: acquisitionId,
      set_id: setId,
      card_id: cardId,
      condition: defaults.condition,
      quantity,
      for_sale: defaults.forSale,
      list_price_pence: defaults.forSale ? poundsToPence(defaults.listPricePounds) : null,
      locale,
    }),
  });

  const json = await res.json();
  
  if (!res.ok) {
    return { error: { message: json.error || "Failed to add card" } };
  }

  return { error: null };
}

