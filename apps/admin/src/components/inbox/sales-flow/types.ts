export type InboxLot = {
  lot_id: string;
  card_id: string;
  card_number: string;
  card_name: string;
  set_name: string;
  rarity: string | null;
  condition: string;
  variation?: string | null;
  status: string;
  for_sale: boolean;
  list_price_pence: number | null;
  quantity: number;
  available_qty: number;
  photo_count: number;
  use_api_image?: boolean;
  api_image_url?: string | null;
  has_front_photo?: boolean;
  has_back_photo?: boolean;
  has_required_photos?: boolean;
};

export type Photo = {
  id: string;
  kind: string;
  signedUrl: string | null;
};

export type SalesData = {
  title: string;
  description: string;
  suggestedPrice: number | null;
};

export type SalesFlowStep = "photos" | "details" | "pricing";

