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
      <Card className="border border-gray-200 shadow-sm h-full flex flex-col bg-gradient-to-br from-white to-emerald-50/30">
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-base text-gray-900">Financial Overview</h3>
          </div>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const isProfitable = data.net_profit_pence >= 0;
  const costBreakdown = {
    purchase: data.purchase_cost_pence,
    consumables: data.consumables_cost_pence,
  };

  return (
    <Card className="border border-gray-200 shadow-sm h-full flex flex-col bg-gradient-to-br from-white to-emerald-50/30 hover:shadow-md transition-shadow">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base text-gray-900">Financial Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">All-time performance</p>
            </div>
          </div>
          <a
            href="/admin/sales"
            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline transition-colors"
          >
            Details →
          </a>
        </div>

        <div className="space-y-4 flex-1 flex flex-col justify-between">
          {/* Revenue */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Total Revenue
              </span>
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="text-2xl font-bold text-green-700">
              £{penceToPounds(data.revenue_pence)}
            </div>
          </div>

          {/* Costs Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Purchase Costs</span>
              <span className="font-semibold text-gray-700">
                £{penceToPounds(costBreakdown.purchase)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Consumables</span>
              <span className="font-semibold text-gray-700">
                £{penceToPounds(costBreakdown.consumables)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total Costs</span>
              <span className="text-base font-semibold text-red-600">
                £{penceToPounds(data.total_costs_pence)}
              </span>
            </div>
          </div>

          {/* Profit Highlight */}
          <div
            className={`pt-4 border-t-2 ${isProfitable ? "border-green-200" : "border-red-200"} bg-gradient-to-r ${isProfitable ? "from-green-50 to-emerald-50" : "from-red-50 to-rose-50"} rounded-lg p-4`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Net Profit</span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isProfitable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {isProfitable ? "✓ Profitable" : "⚠ Loss"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span
                className={`text-3xl font-bold ${isProfitable ? "text-green-700" : "text-red-700"}`}
              >
                £{penceToPounds(data.net_profit_pence)}
              </span>
              <span
                className={`text-lg font-bold ml-2 ${
                  isProfitable ? "text-green-600" : "text-red-600"
                }`}
              >
                {data.margin_percent >= 0 ? "+" : ""}
                {data.margin_percent.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Profit margin</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
