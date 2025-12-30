export type CardInventoryRow = {
  card_id: string;
  set_id: string;
  set_name: string;
  card_number: string;
  card_name: string;
  rarity: string | null;
  image_url: string | null;
  qty_on_hand: number;
  qty_for_sale: number;
  active_lot_count: number;
  sold_lot_count: number;
  updated_at_max: string | null;
};

export type LotRow = {
  id: string;
  card_id: string;
  condition: string;
  qty_total: number;
  qty_available: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: "draft" | "ready" | "listed" | "sold" | "archived";
  note: string | null;
  created_at: string;
  updated_at: string;
  ebay_status: string;
  ebay_last_synced_at: string | null;
  photo_count?: number;
};

export type LotsResponse = {
  active: LotRow[];
  sold: LotRow[];
};

export type BulkActionType =
  | "set_for_sale"
  | "set_list_price"
  | "set_status"
  | "merge";

