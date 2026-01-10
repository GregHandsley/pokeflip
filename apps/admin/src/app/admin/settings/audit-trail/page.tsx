"use client";

import AuditTrail from "@/components/audit/AuditTrail";

export default function AuditTrailPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Trail</h1>
        <p className="text-gray-600">
          Track all important actions including sales, price changes, and status updates.
          Use the undo button to revert critical operations.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <AuditTrail showEntityFilter={true} />
      </div>
    </div>
  );
}

