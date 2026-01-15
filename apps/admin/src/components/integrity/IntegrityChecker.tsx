"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import type { IntegrityReport, IntegrityCheckResult, IntegrityIssue } from "@/lib/integrity/checks";
import { formatDate, formatEntityType, formatExecutionTime } from "@/lib/utils/format";

export default function IntegrityChecker() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningCheck, setRunningCheck] = useState<string | null>(null);

  const runChecks = async (checkType?: string) => {
    setLoading(true);
    setError(null);
    setRunningCheck(checkType || "all");

    try {
      const params = checkType ? `?check=${checkType}` : "";
      const response = await fetch(`/api/admin/integrity/check${params}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to run integrity checks");
      }

      if (checkType) {
        // Single check result
        setReport({
          timestamp: new Date().toISOString(),
          overall_status:
            data.check.status === "pass"
              ? "healthy"
              : data.check.status === "fail"
                ? "unhealthy"
                : "degraded",
          checks: [data.check],
          total_issues: data.check.issues.length,
          execution_time_ms: data.check.execution_time_ms,
        });
      } else {
        // Full report
        setReport(data.report);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run integrity checks");
    } finally {
      setLoading(false);
      setRunningCheck(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
      case "healthy":
        return "bg-green-100 text-green-800 border-green-200";
      case "warning":
      case "degraded":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "fail":
      case "unhealthy":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
      case "healthy":
        return "✓";
      case "warning":
      case "degraded":
        return "⚠";
      case "fail":
      case "unhealthy":
        return "✗";
      default:
        return "?";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      case "warning":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const formatCheckName = (name: string) => {
    const names: Record<string, string> = {
      orphaned_records: "Orphaned Records",
      quantity_consistency: "Quantity Consistency",
      profit_calculations: "Profit Calculations",
    };
    return names[name] || name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Data Integrity Checks</h2>
            <p className="text-sm text-gray-600 mt-1">
              Verify data consistency, check for orphaned records, and validate calculations
            </p>
          </div>
          <Button onClick={() => runChecks()} disabled={loading} variant="primary">
            {loading && runningCheck === "all" ? "Running..." : "Run All Checks"}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => runChecks("orphaned")}
            disabled={loading}
            variant="secondary"
            size="sm"
          >
            {loading && runningCheck === "orphaned" ? "Running..." : "Check Orphaned Records"}
          </Button>
          <Button
            onClick={() => runChecks("quantities")}
            disabled={loading}
            variant="secondary"
            size="sm"
          >
            {loading && runningCheck === "quantities" ? "Running..." : "Check Quantities"}
          </Button>
          <Button
            onClick={() => runChecks("profit")}
            disabled={loading}
            variant="secondary"
            size="sm"
          >
            {loading && runningCheck === "profit" ? "Running..." : "Validate Profit"}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium mb-1">Error</div>
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-4">
          {/* Overall Status */}
          <div className={`border-2 rounded-lg p-4 ${getStatusColor(report.overall_status)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold mb-1">
                  {getStatusIcon(report.overall_status)} Overall Status:{" "}
                  {report.overall_status.toUpperCase()}
                </div>
                <div className="text-sm opacity-90">
                  {report.total_issues} issue{report.total_issues !== 1 ? "s" : ""} found
                  {report.execution_time_ms &&
                    ` • Completed in ${formatExecutionTime(report.execution_time_ms)}`}
                </div>
              </div>
              <div className="text-xs opacity-75">{formatDate(report.timestamp)}</div>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="space-y-3">
            {report.checks.map((check: IntegrityCheckResult) => (
              <div
                key={check.check_name}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Check Header */}
                <div
                  className={`border-l-4 p-4 ${getStatusColor(check.status).split(" ")[0]} bg-opacity-10`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{getStatusIcon(check.status)}</span>
                      <span className="font-semibold text-gray-900">
                        {formatCheckName(check.check_name)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {check.issues.length} issue{check.issues.length !== 1 ? "s" : ""}
                      {" • "}
                      {formatExecutionTime(check.execution_time_ms)}
                    </div>
                  </div>
                  <div
                    className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${getStatusColor(check.status)}`}
                  >
                    {check.status.toUpperCase()}
                  </div>
                </div>

                {/* Issues List */}
                {check.issues.length > 0 && (
                  <div className="border-t border-gray-200 divide-y divide-gray-200">
                    {check.issues.map((issue: IntegrityIssue, index: number) => (
                      <div key={index} className={`p-4 ${getSeverityColor(issue.severity)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {issue.severity === "error" ? "Error" : "Warning"}:
                              </span>
                              <span className="text-sm font-medium">
                                {formatEntityType(issue.entity_type)}
                              </span>
                              <span className="text-xs opacity-75 font-mono">
                                {issue.entity_id.substring(0, 8)}...
                              </span>
                            </div>
                            <div className="text-sm mb-2">{issue.message}</div>
                            {issue.details && Object.keys(issue.details).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                                <div className="text-xs space-y-1">
                                  {Object.entries(issue.details).map(([key, value]) => (
                                    <div key={key}>
                                      <span className="font-medium">{key.replace(/_/g, " ")}:</span>{" "}
                                      <span>{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No Issues */}
                {check.issues.length === 0 && (
                  <div className="p-4 bg-green-50 text-green-700 text-sm text-center">
                    ✓ No issues found
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary when no issues */}
          {report.total_issues === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-green-800 font-semibold text-lg mb-2">✓ All checks passed!</div>
              <div className="text-green-600 text-sm">
                Your data integrity is healthy. All checks completed successfully.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-gray-600 mb-4">
            Click &quot;Run All Checks&quot; to verify your data integrity
          </div>
          <div className="text-sm text-gray-500">
            Checks will verify orphaned records, quantity consistency, and profit calculations
          </div>
        </div>
      )}
    </div>
  );
}
