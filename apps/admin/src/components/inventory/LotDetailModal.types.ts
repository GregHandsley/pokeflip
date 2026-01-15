export type Lot = {
  id: string;
  card_id: string;
  condition: string;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  use_api_image?: boolean;
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

export type Photo = {
  id: string;
  kind: string;
  signedUrl: string | null;
};

export interface LotDetailModalProps {
  lot: Lot;
  onClose: () => void;
  onLotUpdated?: () => void;
  onPhotoCountChanged?: (lotId: string, newCount: number) => void;
}

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

// Function to determine the display status for a lot
// This should match the logic in CardLotsView.tsx for consistency
export function getDisplayStatus(lot: { status: string; for_sale: boolean }): {
  label: string;
  color: string;
} {
  // Priority 1: Sold/Archived status
  if (lot.status === "sold") {
    return { label: "Sold", color: STATUS_COLORS.sold };
  }
  if (lot.status === "archived") {
    return { label: "Archived", color: STATUS_COLORS.archived };
  }

  // Fallback: Show lot status
  return {
    label:
      lot.status === "ready"
        ? "Ready to list"
        : lot.status.charAt(0).toUpperCase() + lot.status.slice(1),
    color: STATUS_COLORS[lot.status] || STATUS_COLORS.draft,
  };
}
