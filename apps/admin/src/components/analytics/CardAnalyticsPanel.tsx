"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

type PricePoint = { date: string; avg_price_pence: number; qty: number };
type ConditionPoint = { condition: string; avg_price_pence: number; qty: number };

type CardAnalytics = {
  priceHistory: PricePoint[];
  avgPriceByCondition: ConditionPoint[];
  qtySoldOverTime: { date: string; qty: number }[];
  avgMarginPercent: number;
};

interface Props {
  cardId: string;
}

const currency = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export default function CardAnalyticsPanel({ cardId }: Props) {
  const [data, setData] = useState<CardAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/analytics/card/${cardId}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to load analytics");
        setData(json);
      } catch (e: any) {
        setError(e.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cardId]);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading analytics…</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">Error: {error}</div>;
  }

  if (!data || data.priceHistory.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded border border-dashed border-gray-200">
        No sales yet for this card.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
      <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Sold Price History</h3>
          <div className="text-xs text-gray-500">
            Avg margin: {data.avgMarginPercent.toFixed(1)}%
          </div>
        </div>
        <div className="h-60 min-h-[240px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.priceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => `£${(v / 100).toFixed(2)}`} />
              <Tooltip
                formatter={(v: number, key) =>
                  key === "avg_price_pence" ? currency(v) : v
                }
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="avg_price_pence"
                stroke="#2563eb"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Average Price by Condition</h3>
          <div className="text-xs text-gray-500">Qty weighted</div>
        </div>
        <div className="h-60 min-h-[240px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.avgPriceByCondition}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="condition" />
              <YAxis tickFormatter={(v) => `£${(v / 100).toFixed(2)}`} />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Bar dataKey="avg_price_pence" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 md:col-span-2 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Quantity Sold Over Time</h3>
        </div>
        <div className="h-60 min-h-[240px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.qtySoldOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="qty" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

