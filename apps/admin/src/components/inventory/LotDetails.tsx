import { penceToPounds } from "@pokeflip/shared";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { getDisplayStatus } from "./LotDetailModal.types";
import type { Lot } from "./LotDetailModal.types";

interface Props {
  lot: Lot;
  canToggleForSale: boolean;
}

export default function LotDetails({ lot, canToggleForSale }: Props) {
  // Match the inventory view logic: show "Missing photos" if photos are missing
  const missingPhotos = !lot.use_api_image && (!lot.photo_count || lot.photo_count < 2);

  return (
    <div className="border-t border-gray-200 pt-4 space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-600">Condition:</span>
        <span className="font-medium">
          {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] || lot.condition}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Total Quantity:</span>
        <span className="font-medium">{lot.quantity}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Available:</span>
        <span className="font-medium text-green-600">{lot.available_qty}</span>
      </div>
      {lot.sold_qty > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">Sold:</span>
          <span className="font-medium text-gray-500">{lot.sold_qty}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-gray-600">Status:</span>
        {missingPhotos ? (
          <span
            className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700"
            title="Add front and back photos"
          >
            Missing photos
          </span>
        ) : (
          (() => {
            const displayStatus = getDisplayStatus({
              status: lot.status,
              for_sale: lot.for_sale,
            });
            return (
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${displayStatus.color}`}
                title={`Status: ${displayStatus.label}`}
              >
                {displayStatus.label}
              </span>
            );
          })()
        )}
      </div>
      {canToggleForSale && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">For Sale:</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                lot.for_sale ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              {lot.for_sale ? "Yes" : "No"}
            </span>
          </div>
        </div>
      )}
      {lot.for_sale && lot.list_price_pence != null && (
        <div className="flex justify-between">
          <span className="text-gray-600">List Price:</span>
          <span className="font-medium text-green-600">£{penceToPounds(lot.list_price_pence)}</span>
        </div>
      )}
      {lot.note && (
        <div className="border-t border-gray-200 pt-2 mt-2">
          <div className="text-sm text-gray-600 italic">{lot.note}</div>
        </div>
      )}
    </div>
  );
}
