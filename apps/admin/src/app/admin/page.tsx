"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { InboxSummary, FinancialOverview, QuickStats } from "@/components/dashboard";

const links = [
  {
    title: "Inbox",
    description: "List-ready lots, pricing and photos at a glance.",
    href: "/admin/inbox",
    cta: "Open Inbox",
  },
  {
    title: "Purchases",
    description: "Add and commit cards from new purchases.",
    href: "/admin/acquisitions",
    cta: "Add Cards",
  },
  {
    title: "Inventory",
    description: "Active lots, quantities, and variations.",
    href: "/admin/inventory",
    cta: "View Inventory",
  },
  {
    title: "Sales & Profit",
    description: "Orders, margin, and export to CSV.",
    href: "/admin/sales",
    cta: "Review Sales",
  },
  {
    title: "Settings",
    description: "Consumables, packaging rules, and defaults.",
    href: "/admin/settings/consumables",
    cta: "Open Settings",
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
        console.error("Failed to load dashboard summary:", e);
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <InboxSummary 
            data={summary?.inbox || null} 
            loading={loading}
          />
          <FinancialOverview 
            data={summary?.overallProfit || null} 
            loading={loading}
          />
        </div>
        <QuickStats 
          data={summary ? {
            purchases: summary.purchases,
            inventory: summary.inventory,
            recentSales: summary.recentSales,
          } : null} 
          loading={loading}
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Card key={link.title} className="border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{link.title}</h2>
              <p className="text-sm text-gray-600">{link.description}</p>
              <a
                href={link.href}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900 underline"
              >
                {link.cta}
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
