"use client";

import PageHeader from "@/components/ui/PageHeader";
import InventoryBySet from "@/components/inventory/InventoryBySet";

export default function InventoryTotalsPage() {
  return (
    <div>
      <PageHeader title="Inventory" />
      <InventoryBySet />
    </div>
  );
}
