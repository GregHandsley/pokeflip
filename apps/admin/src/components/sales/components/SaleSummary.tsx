import type { SaleItem, ConsumableSelection } from "../types";

interface Props {
  saleItems: SaleItem[];
  fees: string;
  shipping: string;
  selectedConsumables: ConsumableSelection[];
  dealDiscount: { type: string; amount: number } | null;
  selectedDealId: string | null;
}

export default function SaleSummary({
  saleItems,
  fees,
  shipping,
  selectedConsumables,
  dealDiscount,
  selectedDealId,
}: Props) {
  const totalRevenue = saleItems.reduce(
    (sum, item) => sum + (item.pricePence ? item.pricePence * item.qty : 0),
    0
  );

  const discountAmount = dealDiscount?.amount || 0;
  const revenueAfterDiscount = Math.max(0, totalRevenue / 100 - discountAmount / 100);

  const feesCost = parseFloat(fees) || 0;
  const shippingCost =
    selectedDealId && dealDiscount?.type === "free_shipping" ? 0 : parseFloat(shipping) || 0;
  const consumablesCost = selectedConsumables.reduce(
    (sum, c) => sum + (c.qty * c.unit_cost_pence) / 100,
    0
  );
  const totalCosts = feesCost + shippingCost + consumablesCost;
  const netProfit = revenueAfterDiscount - totalCosts;
  const margin = revenueAfterDiscount > 0 ? (netProfit / revenueAfterDiscount) * 100 : 0;

  if (saleItems.length === 0) return null;

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      <h3 className="font-semibold text-sm">Sale Summary</h3>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium">£{(totalRevenue / 100).toFixed(2)}</span>
        </div>
        {discountAmount / 100 > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount:</span>
            <span className="font-medium">-£{(discountAmount / 100).toFixed(2)}</span>
          </div>
        )}
        {selectedDealId && dealDiscount?.type === "free_shipping" && shippingCost === 0 && (
          <div className="flex justify-between text-green-600">
            <span>Shipping:</span>
            <span className="font-medium">Free</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t border-gray-300 pt-2">
          <span>Total Revenue:</span>
          <span>£{revenueAfterDiscount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Costs:</span>
          <span className="font-medium text-red-600">-£{totalCosts.toFixed(2)}</span>
        </div>
        <div className="text-xs text-gray-500 pl-4 space-y-1">
          <div className="flex justify-between">
            <span>Fees:</span>
            <span>£{feesCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping:</span>
            <span>£{shippingCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Consumables:</span>
            <span>£{consumablesCost.toFixed(2)}</span>
          </div>
        </div>
        <div className="border-t border-gray-300 pt-2 flex justify-between">
          <span className="font-semibold">Net Profit:</span>
          <span className={`font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            £{netProfit.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Margin:</span>
          <span className={`font-medium ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

