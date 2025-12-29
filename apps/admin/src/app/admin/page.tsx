"use client";

import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default function AdminHome() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Sprint 1: Core schema + intake commit."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-2">Acquisitions</h2>
          <p className="text-sm text-gray-600 mb-4">Manage your card acquisitions</p>
          <a
            href="/admin/acquisitions"
            className="text-sm text-blue-600 hover:underline"
          >
            View Acquisitions →
          </a>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Inventory</h2>
          <p className="text-sm text-gray-600 mb-4">View inventory totals and cards</p>
          <a
            href="/admin/inventory"
            className="text-sm text-blue-600 hover:underline"
          >
            View Inventory →
          </a>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Catalog Sync</h2>
          <p className="text-sm text-gray-600 mb-4">Manage Pokemon TCG sets and cards</p>
          <a
            href="/admin/catalog-sync"
            className="text-sm text-blue-600 hover:underline"
          >
            Manage Catalog →
          </a>
        </Card>

      </div>
    </div>
  );
}
