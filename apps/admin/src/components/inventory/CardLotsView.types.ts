export type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
};

export type Lot = {
  id: string;
  condition: string;
  variation?: string | null;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  bundle_reserved_qty?: number;
  in_bundles?: Array<{ bundleId: string; quantity: number }> | null;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  sku: string | null;
  photo_count: number;
  use_api_image?: boolean;
  purchase: Purchase | null;
  purchases?: Array<Purchase & { quantity: number }>;
};

export type SalesItem = {
  id: string;
  qty: number;
  sold_price_pence: number;
  sold_at: string;
  order_group: string | null;
  platform: string;
  platform_order_ref: string | null;
  buyer_handle: string | null;
  created_at: string;
};

export type CardData = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  image_url: string | null;
  set: { id: string; name: string } | null;
};

export interface CardLotsViewProps {
  cardId: string;
  isExpanded: boolean;
  onLotsChanged?: () => void;
}

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

export function getDisplayStatus(lot: Lot): { label: string; color: string } {
  if (lot.status === "sold") {
    return { label: "Sold", color: STATUS_COLORS.sold };
  }
  if (lot.status === "archived") {
    return { label: "Archived", color: STATUS_COLORS.archived };
  }

  return {
    label:
      lot.status === "ready"
        ? "Ready to list"
        : lot.status.charAt(0).toUpperCase() + lot.status.slice(1),
    color: STATUS_COLORS[lot.status] || STATUS_COLORS.draft,
  };
}
