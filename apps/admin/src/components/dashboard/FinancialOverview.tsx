"use client";

import { penceToPounds } from "@pokeflip/shared";
import Card from "@/components/ui/Card";

type OverallProfit = {
  purchase_cost_pence: number;
  revenue_pence: number;
  consumables_cost_pence: number;
  total_costs_pence: number;
  net_profit_pence: number;
  margin_percent: number;
};

interface Props {
  data: OverallProfit | null;
  loading: boolean;
}

export default function FinancialOverview({ data, loading }: Props) {
  if (loading) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3">Financial Overview</h3>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Financial Overview</h3>
          <a
            href="/admin/sales"
            className="text-xs text-gray-600 hover:text-gray-900 font-medium underline"
          >
            View Details
          </a>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Revenue</span>
            <span className="text-lg font-bold text-green-600">
              £{penceToPounds(data.revenue_pence)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Costs</span>
            <span className="text-base font-semibold text-red-600">
              £{penceToPounds(data.total_costs_pence)}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Net Profit/Loss</span>
              <span className={`text-xl font-bold ${
                data.net_profit_pence >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                £{penceToPounds(data.net_profit_pence)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Margin</span>
              <span className={`text-sm font-semibold ${
                data.margin_percent >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {data.margin_percent >= 0 ? "+" : ""}{data.margin_percent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

