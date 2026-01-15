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
      <Card className="border border-gray-200 shadow-sm">
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3">Quick Stats</h3>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <div className="p-4">
        <h3 className="font-semibold text-sm mb-4">Quick Stats</h3>

        <div className="space-y-4">
          {/* Purchases */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Open Purchases</span>
              <Link
                href="/admin/acquisitions"
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                View
              </Link>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.purchases.open}</div>
          </div>

          {/* Inventory */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Active Inventory</span>
              <a
                href="/admin/inventory"
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                View
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xl font-bold text-gray-900">{data.inventory.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">{data.inventory.listed}</div>
                <div className="text-xs text-gray-500">Listed</div>
              </div>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Last 7 Days</span>
              <a
                href="/admin/sales"
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                View
              </a>
            </div>
            <div className="flex items-center gap-4">
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
          </div>
        </div>
      </div>
    </Card>
  );
}
