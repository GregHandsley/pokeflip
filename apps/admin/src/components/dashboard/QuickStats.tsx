"use client";

import Link from "next/link";
import { penceToPounds } from "@pokeflip/shared";
import Card from "@/components/ui/Card";

type QuickStats = {
  purchases: {
    open: number;
  };
  inventory: {
    total: number;
    listed: number;
  };
  recentSales: {
    count: number;
    revenue_pence: number;
  };
};

interface Props {
  data: QuickStats | null;
  loading: boolean;
}

export default function QuickStats({ data, loading }: Props) {
  if (loading) {
    return (
      <Card className="border border-gray-200 shadow-sm h-full flex flex-col bg-gradient-to-br from-white to-purple-50/30">
        <div className="p-4 flex flex-col">
          <h3 className="font-semibold text-sm mb-3">Quick Stats</h3>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const listedPercentage =
    data.inventory.total > 0 ? Math.round((data.inventory.listed / data.inventory.total) * 100) : 0;
  const avgOrderValue =
    data.recentSales.count > 0 ? data.recentSales.revenue_pence / data.recentSales.count : 0;

  return (
    <Card className="border border-gray-200 shadow-sm h-full flex flex-col bg-gradient-to-br from-white to-purple-50/30 hover:shadow-md transition-shadow">
      <div className="p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-gray-900">Quick Stats</h3>
        </div>

        <div className="space-y-2">
          {/* Purchases */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Open Purchases
                </span>
              </div>
              <Link
                href="/admin/acquisitions"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline transition-colors"
              >
                View →
              </Link>
            </div>
            <div className="text-2xl font-bold text-indigo-700">{data.purchases.open}</div>
            <p className="text-xs text-gray-500 mt-0.5">Active purchase orders</p>
          </div>

          {/* Inventory */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-3 border border-teal-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-teal-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Active Inventory
                </span>
              </div>
              <a
                href="/admin/inventory"
                className="text-xs text-teal-600 hover:text-teal-800 font-medium underline transition-colors"
              >
                View →
              </a>
            </div>
            <div className="flex items-baseline gap-3 mb-1.5">
              <div>
                <div className="text-xl font-bold text-gray-900">{data.inventory.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div>
                <div className="text-xl font-bold text-teal-600">{data.inventory.listed}</div>
                <div className="text-xs text-gray-500">Listed</div>
              </div>
            </div>
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-gray-600">Listed Rate</span>
                <span className="font-semibold text-teal-700">{listedPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-teal-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${listedPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-green-600"
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
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Last 7 Days
                </span>
              </div>
              <a
                href="/admin/sales"
                className="text-xs text-green-600 hover:text-green-800 font-medium underline transition-colors"
              >
                View →
              </a>
            </div>
            <div className="flex items-baseline gap-3 mb-1">
              <div>
                <div className="text-xl font-bold text-gray-900">{data.recentSales.count}</div>
                <div className="text-xs text-gray-500">Orders</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">
                  £{penceToPounds(data.recentSales.revenue_pence)}
                </div>
                <div className="text-xs text-gray-500">Revenue</div>
              </div>
            </div>
            {avgOrderValue > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Avg: £{penceToPounds(avgOrderValue)} per order
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
