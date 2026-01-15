export type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export type PurchaseLot = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  ebay_status: string;
  photo_count: number;
  use_api_image?: boolean;
  is_draft?: boolean;
  card: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export type ProfitData = {
  purchase_cost_pence: number;
  revenue_pence: number;
  revenue_after_discount_pence?: number;
  consumables_cost_pence: number;
  total_costs_pence: number;
  net_profit_pence: number;
  margin_percent: number;
  roi_percent: number;
  cards_sold: number;
  cards_total: number;
};
