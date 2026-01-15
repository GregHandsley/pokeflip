import { penceToPounds } from "@pokeflip/shared";
import type { PromotionalDeal, SaleItem } from "../types";

interface Props {
  promotionalDeals: PromotionalDeal[];
  selectedDealId: string | null;
  saleItems: SaleItem[];
  dealDiscount: { type: string; amount: number } | null;
  onDealChange: (dealId: string | null) => void;
}

export default function PromotionalDealSelector({
  promotionalDeals,
  selectedDealId,
  saleItems,
  dealDiscount,
  onDealChange,
}: Props) {
  if (promotionalDeals.length === 0) return null;

  const totalCardCount = saleItems.reduce((sum, item) => sum + item.qty, 0);
  const availableDeals = promotionalDeals.filter(
    (deal) =>
      deal.is_active &&
      totalCardCount >= deal.min_card_count &&
      (!deal.max_card_count || totalCardCount <= deal.max_card_count)
  );

  if (availableDeals.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Apply Promotional Deal (optional)
      </label>
      <select
        value={selectedDealId || ""}
        onChange={(e) => onDealChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
      >
        <option value="">No deal</option>
        {availableDeals.map((deal) => (
          <option key={deal.id} value={deal.id}>
            {deal.name}
          </option>
        ))}
      </select>
      {selectedDealId && dealDiscount && (
        <div className="mt-2 text-sm">
          {dealDiscount.type === "free_shipping" ? (
            <span className="text-green-600 font-medium">Free shipping applied</span>
          ) : (
            <span className="text-green-600 font-medium">
              Discount: £{penceToPounds(dealDiscount.amount)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
