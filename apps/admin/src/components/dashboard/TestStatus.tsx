"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { logger } from "@/lib/logger";

type TestStatus = {
  ok: boolean;
  status: "passing" | "failing" | "error";
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  timestamp: string;
};

export default function TestStatus() {
  const router = useRouter();
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTestStatus = async () => {
      try {
        const res = await fetch("/api/admin/tests/status");

        // If endpoint doesn't exist (404), silently fail - this is expected
        if (!res.ok && res.status === 404) {
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setTestStatus(data);
      } catch (error: unknown) {
        // Only log errors that aren't 404 (endpoint not found)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage && !errorMessage.includes("404")) {
          logger.error(
            "Failed to load test status",
            error instanceof Error ? error : new Error(errorMessage)
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadTestStatus();
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="p-4">
          <div className="text-sm text-gray-500">Loading test status...</div>
        </div>
      </Card>
    );
  }

  if (!testStatus) {
    return null;
  }

  const getStatusColor = () => {
    if (testStatus.status === "passing") return "bg-green-500";
    if (testStatus.status === "failing") return "bg-red-500";
    return "bg-yellow-500";
  };

  const allPassing = testStatus.status === "passing" && testStatus.summary.total > 0;

  return (
    <Card>
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => router.push("/admin/tests")}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Test Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            <span className="text-xs text-gray-600">View Details →</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold text-gray-900">
            {testStatus.summary.passed}/{testStatus.summary.total}
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">
              {allPassing ? "All tests passing" : `${testStatus.summary.failed} failing`}
            </div>
            <div className="text-xs text-gray-500">
              Testing: Profit calculations, SKU generation
            </div>
            {testStatus.summary.failed > 0 && (
              <div className="text-xs text-red-600 font-medium mt-1">
                {testStatus.summary.failed} test{testStatus.summary.failed !== 1 ? "s" : ""} need
                attention
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
