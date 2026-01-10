"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { logger } from "@/lib/logger";
import MonitoringDashboard from "@/components/monitoring/MonitoringDashboard";

type PerformanceMetrics = {
  database: {
    status: string;
    queryTimeMs: number;
    error?: string;
  };
  indexes: {
    total: number;
    active: number;
    details: Array<{
      name: string;
      description: string;
      status: string;
    }>;
  };
  cache: {
    serverSide: {
      type: string;
      ttl: string;
      scope: string;
    };
    clientSide: {
      type: string;
      ttl: string;
      scope: string;
      note: string;
    };
  };
  optimizations: {
    imageLazyLoading: string;
    webpFormat: string;
    loadingStates: string;
    virtualScrolling: string;
  };
  timestamp: string;
};

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/performance/metrics");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load metrics");
      }
      setMetrics(json.metrics);
    } catch (e: any) {
      logger.error("Failed to load performance metrics", e);
      setError(e.message || "Failed to load performance metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
  }, []);

  return (
    <div className="space-y-8">
      {/* Monitoring Dashboard */}
      <div className="space-y-4">
        <PageHeader
          title="System Monitoring"
          description="Health checks, business metrics, and alert status"
        />
        <MonitoringDashboard />
      </div>

      {/* Performance Metrics */}
      <div className="space-y-4 border-t border-gray-200 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Performance Metrics</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track database performance, index usage, and optimization status
            </p>
          </div>
          <Button onClick={loadMetrics} disabled={loading} variant="secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <div className="text-sm text-red-700">{error}</div>
          </Card>
        )}

        {loading && !metrics && (
          <div className="text-center py-8 text-gray-500">Loading performance metrics...</div>
        )}

        {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Database Status */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Database Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Connection</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    metrics.database.status === "connected"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {metrics.database.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Query Time</span>
                <span className="text-sm font-medium">
                  {metrics.database.queryTimeMs}ms
                </span>
              </div>
              {metrics.database.error && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {metrics.database.error}
                </div>
              )}
            </div>
          </Card>

          {/* Indexes */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Performance Indexes</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Indexes</span>
                <span className="text-sm font-medium">{metrics.indexes.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Indexes</span>
                <span className="text-sm font-medium text-green-600">
                  {metrics.indexes.active}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-500 mb-2">Index Details</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {metrics.indexes.details.map((idx) => (
                    <div key={idx.name} className="text-xs">
                      <div className="font-medium text-gray-900">{idx.name}</div>
                      <div className="text-gray-600 mt-0.5">{idx.description}</div>
                      <div className="mt-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            idx.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {idx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Caching */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Caching</h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Server-Side</div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{metrics.cache.serverSide.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TTL:</span>
                    <span className="font-medium">{metrics.cache.serverSide.ttl}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    {metrics.cache.serverSide.scope}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-500 mb-2">Client-Side</div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{metrics.cache.clientSide.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TTL:</span>
                    <span className="font-medium">{metrics.cache.clientSide.ttl}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    {metrics.cache.clientSide.scope}
                  </div>
                  <div className="text-gray-500 text-xs mt-1 italic">
                    {metrics.cache.clientSide.note}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Optimizations */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Optimizations</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Image Lazy Loading</span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  {metrics.optimizations.imageLazyLoading}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">WebP Format</span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  {metrics.optimizations.webpFormat}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Loading States</span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  {metrics.optimizations.loadingStates}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Virtual Scrolling</span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  {metrics.optimizations.virtualScrolling}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

        {metrics && (
          <Card className="bg-gray-50">
            <div className="text-xs text-gray-500">
              Last updated: {new Date(metrics.timestamp).toLocaleString()}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

