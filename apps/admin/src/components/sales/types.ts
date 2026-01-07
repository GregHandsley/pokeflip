export type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
  quantity: number;
};

export type ListedLot = {
  id: string;
  condition: string;
  variation: string;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  list_price_pence: number | null;
  purchases?: Purchase[];
  card: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    api_image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export type PurchaseAllocation = {
  purchaseId: string;
  qty: number;
};

export type SaleItem = {
  lotId: string;
  lot: ListedLot | null;
  qty: number;
  pricePence: number | null;
  isFree: boolean;
  selectedPurchaseId?: string | null;
  manualAllocation?: boolean;
  purchaseAllocations?: PurchaseAllocation[];
};

export type PromotionalDeal = {
  id: string;
  name: string;
  description: string | null;
  deal_type: "percentage_off" | "fixed_off" | "free_shipping" | "buy_x_get_y";
  discount_percent: number | null;
  discount_amount_pence: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  min_card_count: number;
  max_card_count: number | null;
  is_active: boolean;
};

export type Buyer = {
  id: string;
  handle: string;
  platform: string;
  order_count?: number;
  total_spend_pence?: number;
};

export type Consumable = {
  consumable_id: string;
  name: string;
  unit: string;
  avg_cost_pence_per_unit: number;
};

export type ConsumableSelection = {
  consumable_id: string;
  consumable_name: string;
  qty: number;
  unit_cost_pence: number;
};

