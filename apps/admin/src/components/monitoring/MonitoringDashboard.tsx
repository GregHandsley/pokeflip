"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { logger } from "@/lib/logger";
import { formatPrice } from "@/lib/utils/format";

type HealthCheck = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: {
      status: "healthy" | "unhealthy";
      responseTimeMs?: number;
      error?: string;
    };
    uptime: {
      seconds: number;
    };
  };
  version?: string;
};

type BusinessMetrics = {
  sales: {
    totalSalesCount: number;
    totalRevenuePence: number;
    recentSalesCount: number;
    recentRevenuePence: number;
    averageOrderValuePence: number;
    timestamp: string;
  };
  inventory: {
    totalLots: number;
    activeLots: number;
    listedLots: number;
    soldLots: number;
    totalQuantity: number;
    availableQuantity: number;
    lowStockThreshold: number;
    timestamp: string;
  };
  timestamp: string;
};

export default function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState<"health" | "metrics">("health");
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealthCheck = async () => {
    setLoadingHealth(true);
    setError(null);
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      if (!res.ok && res.status !== 503) {
        throw new Error(json.error || "Failed to load health check");
      }
      setHealthCheck(json);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      logger.error("Failed to load health check", error);
      setError(error.message || "Failed to load health check");
    } finally {
      setLoadingHealth(false);
    }
  };

  const loadBusinessMetrics = async (days: number = 7) => {
    setLoadingMetrics(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/monitoring/metrics?days=${days}`);
      const json = await res.json();
      if (!res.ok) {
        const errorMessage = json.error || json.message || `Failed to load metrics (${res.status})`;
        throw new Error(errorMessage);
      }
      if (!json.metrics) {
        throw new Error("Invalid response: metrics data missing");
      }
      setBusinessMetrics(json.metrics);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      const errorMessage = error.message || "Failed to load business metrics";
      logger.error("Failed to load business metrics", error, undefined, {
        operation: "load_business_metrics",
        days,
      });
      setError(errorMessage);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    void loadHealthCheck();
    void loadBusinessMetrics();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void loadHealthCheck();
      void loadBusinessMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "unhealthy":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 -ml-4 -mr-4 px-4">
        <button
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "health"
              ? "border-b-2 border-black text-black"
              : "text-gray-600 hover:text-black"
          }`}
        >
          Health Check
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "metrics"
              ? "border-b-2 border-black text-black"
              : "text-gray-600 hover:text-black"
          }`}
        >
          Business Metrics
        </button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      )}

      {/* Health Check Tab */}
      {activeTab === "health" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">System Health</h3>
            <Button
              onClick={loadHealthCheck}
              disabled={loadingHealth}
              variant="secondary"
              size="sm"
            >
              {loadingHealth ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {loadingHealth && !healthCheck && (
            <div className="text-center py-8 text-gray-500">Loading health check...</div>
          )}

          {healthCheck && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overall Status */}
              <Card>
                <h4 className="font-semibold text-base mb-4">Overall Status</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(
                        healthCheck.status
                      )}`}
                    >
                      {healthCheck.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Uptime</span>
                    <span className="text-sm font-medium">
                      {formatDuration(healthCheck.checks.uptime.seconds)}
                    </span>
                  </div>
                  {healthCheck.version && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Version</span>
                      <span className="text-sm font-medium">{healthCheck.version}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Check</span>
                    <span className="text-sm font-medium text-gray-500">
                      {new Date(healthCheck.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Database Status */}
              <Card>
                <h4 className="font-semibold text-base mb-4">Database</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Connection</span>
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        healthCheck.checks.database.status === "healthy"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {healthCheck.checks.database.status}
                    </span>
                  </div>
                  {healthCheck.checks.database.responseTimeMs !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Response Time</span>
                      <span
                        className={`text-sm font-medium ${
                          healthCheck.checks.database.responseTimeMs > 1000
                            ? "text-yellow-600"
                            : healthCheck.checks.database.responseTimeMs > 500
                              ? "text-orange-600"
                              : "text-green-600"
                        }`}
                      >
                        {healthCheck.checks.database.responseTimeMs}ms
                      </span>
                    </div>
                  )}
                  {healthCheck.checks.database.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      {healthCheck.checks.database.error}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Business Metrics Tab */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Business Metrics</h3>
            <Button
              onClick={() => loadBusinessMetrics()}
              disabled={loadingMetrics}
              variant="secondary"
              size="sm"
            >
              {loadingMetrics ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {loadingMetrics && !businessMetrics && (
            <div className="text-center py-8 text-gray-500">Loading business metrics...</div>
          )}

          {businessMetrics && (
            <div className="space-y-6">
              {/* Sales Metrics */}
              <div>
                <h4 className="font-semibold text-base mb-4">Sales Volume</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Total Sales</div>
                    <div className="text-2xl font-bold">
                      {businessMetrics.sales.totalSalesCount}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Revenue: {formatPrice(businessMetrics.sales.totalRevenuePence)}
                    </div>
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Recent Sales (7 days)</div>
                    <div className="text-2xl font-bold">
                      {businessMetrics.sales.recentSalesCount}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Revenue: {formatPrice(businessMetrics.sales.recentRevenuePence)}
                    </div>
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Average Order Value</div>
                    <div className="text-2xl font-bold">
                      {formatPrice(businessMetrics.sales.averageOrderValuePence)}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Inventory Metrics */}
              <div>
                <h4 className="font-semibold text-base mb-4">Inventory Levels</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Total Lots</div>
                    <div className="text-2xl font-bold">{businessMetrics.inventory.totalLots}</div>
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Active Lots</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {businessMetrics.inventory.activeLots}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Listed: {businessMetrics.inventory.listedLots}
                    </div>
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Available Quantity</div>
                    <div
                      className={`text-2xl font-bold ${
                        businessMetrics.inventory.availableQuantity <
                        businessMetrics.inventory.lowStockThreshold
                          ? "text-red-600"
                          : businessMetrics.inventory.availableQuantity <
                              businessMetrics.inventory.lowStockThreshold * 2
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {businessMetrics.inventory.availableQuantity}
                    </div>
                    {businessMetrics.inventory.availableQuantity <
                      businessMetrics.inventory.lowStockThreshold && (
                      <div className="text-xs text-red-600 mt-2 font-medium">⚠ Low Stock Alert</div>
                    )}
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-600 mb-1">Sold Lots</div>
                    <div className="text-2xl font-bold text-gray-600">
                      {businessMetrics.inventory.soldLots}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Total Qty: {businessMetrics.inventory.totalQuantity}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Last Updated */}
              <Card className="bg-gray-50">
                <div className="text-xs text-gray-500">
                  Last updated: {new Date(businessMetrics.timestamp).toLocaleString()}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
