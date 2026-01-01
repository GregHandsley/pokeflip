"use client";

import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

const links = [
  {
    title: "Inbox",
    description: "List-ready lots, pricing and photos at a glance.",
    href: "/admin/inbox",
    cta: "Open Inbox",
  },
  {
    title: "Acquisitions",
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

const shortcuts = [
  { key: "/", label: "Focus filters" },
  { key: "e / m", label: "Open selected lot" },
  { key: "c / Esc", label: "Close modal" },
  { key: "?", label: "Shortcut help" },
];

export default function AdminHome() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Center"
        description="Stay on top of acquisitions, listing readiness, and sales. Built for fast daily ops."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Card key={link.title} className="border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{link.title}</h2>
              <p className="text-sm text-gray-600">{link.description}</p>
              <a
                href={link.href}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {link.cta} →
              </a>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Ops essentials</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>• Inbox highlights show high-value and missing-photo lots immediately.</li>
            <li>• Pricing step refreshes market snapshots (Cardmarket/TCGplayer via TCGdex).</li>
            <li>• Variations now respect TCGdex availability to avoid listing wrong variants.</li>
          </ul>
        </Card>

        <Card className="border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Keyboard shortcuts</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            {shortcuts.map((s) => (
              <li key={s.key} className="flex items-center justify-between">
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-800">
                  {s.key}
                </span>
                <span className="text-xs text-gray-700">{s.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
