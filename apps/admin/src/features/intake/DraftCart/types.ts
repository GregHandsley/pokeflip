import type { Condition } from "../types";

export type DraftLine = {
  id: string;
  card_id: string;
  set_id: string;
  condition: Condition;
  variation?: string | null;
  quantity: number;
  for_sale: boolean;
  list_price_pence?: number | null;
  note: string | null;
  cards: {
    number: string;
    name: string;
    api_image_url: string | null;
    api_payload?: unknown;
  } | null;
  sets: { name: string } | null;
};
