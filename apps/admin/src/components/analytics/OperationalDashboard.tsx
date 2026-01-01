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
import { penceToPounds } from "@pokeflip/shared";

type Series = { date: string; value: number };
type ProfitPoint = {
  date: string;
  revenue_pence: number;
  net_profit_pence: number;
  margin_percent: number;
};

type DashboardData = {
  itemsAdded: Series[];
  itemsListed: Series[];
  itemsSold: Series[];
  sellThroughBySet: Array<{
    set_id: string;
    set_name: string;
    sold: number;
    total: number;
    sell_through_rate: number;
  }>;
  profitTrend: ProfitPoint[];
  period: string;
};

const sumSeries = (series: Series[]) =>
  series.reduce((sum, p) => sum + (p.value || 0), 0);

export default function OperationalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/analytics/dashboard");
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to load dashboard");
        setData(json);
      } catch (e: any) {
        setError(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (error)
    return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!data) return null;

  const kpiCards = [
    { label: "Items Added", value: sumSeries(data.itemsAdded) },
    { label: "Items Listed", value: sumSeries(data.itemsListed) },
    { label: "Items Sold", value: sumSeries(data.itemsSold) },
    {
      label: "Avg Margin",
      value:
        data.profitTrend.length > 0
          ? (
              data.profitTrend.reduce(
                (s, p) => s + (p.margin_percent || 0),
                0
              ) / data.profitTrend.length
            ).toFixed(1)
          : "0",
      suffix: "%",
    },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            <div className="text-xs text-gray-500">{kpi.label}</div>
            <div className="text-xl font-semibold">
              {kpi.value}
              {kpi.suffix}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Items Added / Listed / Sold</h3>
            <div className="text-xs text-gray-500">{data.period}</div>
          </div>
          <div className="h-64 min-h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  data={data.itemsAdded}
                  name="Added"
                  stroke="#2563eb"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  data={data.itemsListed}
                  name="Listed"
                  stroke="#10b981"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  data={data.itemsSold}
                  name="Sold"
                  stroke="#f59e0b"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
          <h3 className="font-semibold text-sm mb-2">Profit Trend</h3>
          <div className="h-64 min-h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.profitTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis
                  tickFormatter={(v) => `£${(v / 100).toFixed(0)}`}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v: number, key: string) =>
                    key === "margin_percent"
                      ? `${v.toFixed(1)}%`
                      : `£${(v / 100).toFixed(2)}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="net_profit_pence"
                  name="Net Profit"
                  stroke="#16a34a"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="revenue_pence"
                  name="Revenue"
                  stroke="#2563eb"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
        <h3 className="font-semibold text-sm mb-2">Sell-through by Set (Top 10)</h3>
        <div className="h-72 min-h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.sellThroughBySet}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="set_name" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                formatter={(v: number, key: string) =>
                  key === "sell_through_rate"
                    ? `${(v * 100).toFixed(1)}%`
                    : v
                }
              />
              <Bar dataKey="sell_through_rate" name="Sell-through" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

