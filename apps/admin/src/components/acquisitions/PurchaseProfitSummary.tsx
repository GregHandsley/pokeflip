import { penceToPounds } from "@pokeflip/shared";
import type { ProfitData } from "./types";

type PurchaseProfitSummaryProps = {
  profitData: ProfitData;
  loading?: boolean;
};

export function PurchaseProfitSummary({ profitData, loading = false }: PurchaseProfitSummaryProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4">Profit & Loss</h3>
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <h3 className="text-lg font-semibold mb-4">Profit & Loss</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-600 mb-1">Purchase Cost</div>
            <div className="text-lg font-semibold text-red-600">
              £{penceToPounds(profitData.purchase_cost_pence)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Revenue</div>
            <div className="text-lg font-semibold text-green-600">
              £{penceToPounds(profitData.revenue_after_discount_pence ?? profitData.revenue_pence)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Consumables</div>
            <div className="text-lg font-semibold text-orange-600">
              £{penceToPounds(profitData.consumables_cost_pence)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Net Profit/Loss</div>
            <div
              className={`text-lg font-bold ${
                profitData.net_profit_pence >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              £{penceToPounds(profitData.net_profit_pence)}
            </div>
            <div
              className={`text-xs mt-1 ${
                (profitData.margin_percent || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(profitData.margin_percent || 0) >= 0 ? "+" : ""}
              {(profitData.margin_percent || 0).toFixed(1)}% margin
            </div>
            <div
              className={`text-xs mt-0.5 ${
                (profitData.roi_percent || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(profitData.roi_percent || 0) >= 0 ? "+" : ""}
              {(profitData.roi_percent || 0).toFixed(1)}% ROI
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Cards sold: <span className="font-medium">{profitData.cards_sold}</span> of{" "}
            <span className="font-medium">{profitData.cards_total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
