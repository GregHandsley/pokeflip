"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Link from "next/link";

type PerformanceMetrics = {
  database: {
    status: string;
    queryTimeMs: number;
  };
  indexes: {
    total: number;
    active: number;
  };
};

export default function PerformanceStatus() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const res = await fetch("/api/admin/performance/metrics");
        const json = await res.json();
        if (json.ok && json.metrics) {
          setMetrics({
            database: json.metrics.database,
            indexes: json.metrics.indexes,
          });
        }
      } catch (e) {
        // Silently fail - this is just a status widget
      } finally {
        setLoading(false);
      }
    };

    void loadMetrics();
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Performance</h3>
        </div>
        <div className="text-xs text-gray-500">Loading...</div>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Performance</h3>
        <Link
          href="/admin/settings/performance"
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          View Details
        </Link>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Database</span>
          <span
            className={`px-1.5 py-0.5 rounded font-medium ${
              metrics.database.status === "connected"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {metrics.database.status === "connected" ? "✓" : "✗"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Query Time</span>
          <span className="font-medium">
            {metrics.database.queryTimeMs}ms
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Indexes</span>
          <span className="font-medium text-green-600">
            {metrics.indexes.active}/{metrics.indexes.total}
          </span>
        </div>
      </div>
    </Card>
  );
}

