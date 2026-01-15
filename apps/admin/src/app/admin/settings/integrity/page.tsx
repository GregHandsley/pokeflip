"use client";

import IntegrityChecker from "@/components/integrity/IntegrityChecker";

export default function IntegrityPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Integrity Checks</h1>
        <p className="text-gray-600">
          Run periodic data validation to check for orphaned records, verify quantity consistency,
          and validate profit calculations.
        </p>
      </div>

      <IntegrityChecker />
    </div>
  );
}
