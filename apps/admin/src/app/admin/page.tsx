"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { InboxSummary, FinancialOverview, QuickStats } from "@/components/dashboard";
import { logger } from "@/lib/logger";

const links = [
  {
    title: "Inbox",
    description: "List-ready lots, pricing and photos at a glance.",
    href: "/admin/inbox",
    cta: "Open Inbox",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Purchases",
    description: "Add and commit cards from new purchases.",
    href: "/admin/acquisitions",
    cta: "Add Cards",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
    ),
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    title: "Inventory",
    description: "Active lots, quantities, and variations.",
    href: "/admin/inventory",
    cta: "View Inventory",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
    color: "bg-teal-100 text-teal-600",
  },
  {
    title: "Sales & Profit",
    description: "Orders, margin, and export to CSV.",
    href: "/admin/sales",
    cta: "Review Sales",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Settings",
    description: "Consumables, packaging rules, and defaults.",
    href: "/admin/settings/consumables",
    cta: "Open Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    color: "bg-purple-100 text-purple-600",
  },
];

type DashboardSummary = {
  inbox: {
    readyToList: number;
    needsPhotos: number;
    highValueReady: number;
  };
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
  consumables?: {
    lowStockCount: number;
    outOfStockCount: number;
  };
  overallProfit: {
    purchase_cost_pence: number;
    revenue_pence: number;
    consumables_cost_pence: number;
    total_costs_pence: number;
    net_profit_pence: number;
    margin_percent: number;
  } | null;
};

export default function AdminHome() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const workQueue = summary
    ? {
        total: summary.inbox.readyToList + summary.inbox.needsPhotos + summary.inbox.highValueReady,
        highValueReady: summary.inbox.highValueReady,
      }
    : null;
  const unlistedLots = summary
    ? Math.max(summary.inventory.total - summary.inventory.listed, 0)
    : null;

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dashboard/summary");
        const json = await res.json();
        if (json.ok) {
          setSummary(json);
        }
      } catch (e) {
        logger.error("Failed to load dashboard summary", e);
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Center"
        description="Stay on top of purchases, listing readiness, and sales. Built for fast daily ops."
      />

      {/* Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 grid gap-4 lg:grid-rows-[auto,1fr]">
          <InboxSummary data={summary?.inbox || null} loading={loading} />
          <div className="h-full">
            <FinancialOverview data={summary?.overallProfit || null} loading={loading} />
          </div>
        </div>
        <div className="h-full flex flex-col gap-4">
          <div className="flex-1">
            <QuickStats
              data={
                summary
                  ? {
                      purchases: summary.purchases,
                      inventory: summary.inventory,
                      recentSales: summary.recentSales,
                    }
                  : null
              }
              loading={loading}
            />
          </div>
          <Card className="flex-1 border border-gray-200 shadow-sm flex flex-col">
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Ops Snapshot</h4>
                <span className="text-xs text-gray-500">Today</span>
              </div>
              {loading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : summary ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Unlisted lots</span>
                    <span className="font-semibold text-gray-900">{unlistedLots}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Work queue</span>
                    <span className="font-semibold text-gray-900">{workQueue?.total ?? 0}</span>
                  </div>
                  {workQueue && workQueue.highValueReady > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">High-value ready</span>
                      <span className="font-semibold text-green-700">
                        {workQueue.highValueReady}
                      </span>
                    </div>
                  )}
                  {(summary.consumables?.outOfStockCount || 0) > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Consumables out</span>
                      <span className="font-semibold text-red-700">
                        {summary.consumables?.outOfStockCount ?? 0}
                      </span>
                    </div>
                  ) : null}
                  {(summary.consumables?.lowStockCount || 0) > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Consumables low</span>
                      <span className="font-semibold text-yellow-800">
                        {summary.consumables?.lowStockCount ?? 0}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <Card
              key={link.title}
              className="border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all group cursor-pointer"
            >
              <a href={link.href} className="block">
                <div className="flex items-start gap-4 p-5">
                  <div
                    className={`w-12 h-12 rounded-xl ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    {link.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{link.description}</p>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 inline-flex items-center gap-1 transition-colors">
                      {link.cta}
                      <svg
                        className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
