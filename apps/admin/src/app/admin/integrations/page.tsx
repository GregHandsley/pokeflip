"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader title="Integrations" description="Connect and configure external services" />

      <div className="mt-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
          No integrations configured yet.
        </div>
      </div>
    </div>
  );
}
