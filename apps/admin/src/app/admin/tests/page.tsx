"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
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
  testFiles: Array<{
    path: string;
    numPassingTests: number;
    numFailingTests: number;
    numSkippedTests: number;
    status: "passed" | "failed" | "skipped";
    tests: Array<{
      title: string;
      fullName: string;
      status: string;
      category: string;
      subcategory: string | null;
      duration: number;
      failureMessages: string[];
    }>;
    testsByCategory: Record<
      string,
      Array<{
        title: string;
        fullName: string;
        status: string;
        category: string;
        subcategory: string | null;
        duration: number;
        failureMessages: string[];
      }>
    >;
    categories: string[];
  }>;
  timestamp: string;
  error?: string;
};

export default function TestsPage() {
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTestStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tests/status");
      const data = await res.json();
      setTestStatus(data);
    } catch (error: unknown) {
      logger.error("Failed to load test status", error);
      setTestStatus({
        ok: false,
        status: "error",
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
        testFiles: [],
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTestStatus();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTestStatus();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passing":
        return "bg-green-500";
      case "failing":
        return "bg-red-500";
      case "error":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "passing":
        return "All Tests Passing";
      case "failing":
        return "Some Tests Failing";
      case "error":
        return "Error Running Tests";
      default:
        return "Unknown Status";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Test Status"
        description="View test results and system health"
        action={
          <Button variant="secondary" onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? "Refreshing..." : "Refresh Tests"}
          </Button>
        }
      />

      {loading ? (
        <Card>
          <div className="p-6 text-center">
            <div className="text-gray-600">Loading test status...</div>
          </div>
        </Card>
      ) : testStatus ? (
        <>
          {/* Status Overview */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Overall Status</h2>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${getStatusColor(testStatus.status)}`} />
                  <span className="font-medium">{getStatusText(testStatus.status)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{testStatus.summary.total}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Tests</div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {testStatus.summary.passed}
                  </div>
                  <div className="text-sm text-green-700 mt-1">Passed</div>
                </div>

                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{testStatus.summary.failed}</div>
                  <div className="text-sm text-red-700 mt-1">Failed</div>
                </div>

                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {testStatus.summary.skipped}
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">Skipped</div>
                </div>
              </div>

              {testStatus.error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  <strong>Error:</strong> {testStatus.error}
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                Last updated: {new Date(testStatus.timestamp).toLocaleString()}
              </div>
            </div>
          </Card>

          {/* Test Files with Details */}
          {testStatus.testFiles.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Test Files & Test Details</h2>
                <div className="space-y-4">
                  {testStatus.testFiles.map((file, fileIndex) => (
                    <div
                      key={fileIndex}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* File Header */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`w-3 h-3 rounded-full shrink-0 ${
                              file.status === "passed"
                                ? "bg-green-500"
                                : file.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {file.path}
                            </div>
                            <div className="text-xs text-gray-500">
                              {file.numPassingTests} passed, {file.numFailingTests} failed
                              {file.numSkippedTests > 0 && `, ${file.numSkippedTests} skipped`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Test Categories and Tests */}
                      <div className="p-4 space-y-4">
                        {file.categories && file.categories.length > 0 ? (
                          file.categories.map((category, catIndex) => {
                            const categoryTests = file.testsByCategory[category] || [];
                            const categoryPassing = categoryTests.filter(
                              (t) => t.status === "passed"
                            ).length;
                            // const categoryFailing = categoryTests.filter((t) => t.status === "failed").length;

                            return (
                              <div key={catIndex} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-gray-700">
                                    {category}
                                  </h3>
                                  <span className="text-xs text-gray-500">
                                    {categoryPassing}/{categoryTests.length} passing
                                  </span>
                                </div>
                                <div className="ml-4 space-y-1">
                                  {categoryTests.map((test, testIndex) => (
                                    <div
                                      key={testIndex}
                                      className={`flex items-start gap-2 text-xs p-2 rounded ${
                                        test.status === "passed"
                                          ? "bg-green-50 border border-green-200"
                                          : test.status === "failed"
                                            ? "bg-red-50 border border-red-200"
                                            : "bg-yellow-50 border border-yellow-200"
                                      }`}
                                    >
                                      <div
                                        className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                                          test.status === "passed"
                                            ? "bg-green-500"
                                            : test.status === "failed"
                                              ? "bg-red-500"
                                              : "bg-yellow-500"
                                        }`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div
                                          className={`font-medium ${
                                            test.status === "passed"
                                              ? "text-green-800"
                                              : test.status === "failed"
                                                ? "text-red-800"
                                                : "text-yellow-800"
                                          }`}
                                        >
                                          {test.title}
                                        </div>
                                        {test.subcategory && (
                                          <div className="text-gray-600 mt-0.5">
                                            {test.subcategory}
                                          </div>
                                        )}
                                        {test.failureMessages &&
                                          test.failureMessages.length > 0 && (
                                            <div className="mt-1 text-red-700 font-mono text-xs">
                                              {test.failureMessages.join("\n")}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-sm text-gray-500 text-center py-2">
                            No test details available
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Status Lights */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">System Health Indicators</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div
                    className={`w-6 h-6 rounded-full ${
                      testStatus.summary.total > 0
                        ? testStatus.status === "passing"
                          ? "bg-green-500"
                          : "bg-red-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <div>
                    <div className="font-medium text-sm">Unit Tests</div>
                    <div className="text-xs text-gray-600">
                      {testStatus.summary.total > 0
                        ? testStatus.status === "passing"
                          ? "All passing"
                          : `${testStatus.summary.failed} failing`
                        : "No tests"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div
                    className={`w-6 h-6 rounded-full ${
                      testStatus.ok ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <div>
                    <div className="font-medium text-sm">Test Runner</div>
                    <div className="text-xs text-gray-600">
                      {testStatus.ok ? "Operational" : "Error"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div
                    className={`w-6 h-6 rounded-full ${
                      testStatus.testFiles.length > 0 ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <div>
                    <div className="font-medium text-sm">Test Coverage</div>
                    <div className="text-xs text-gray-600">
                      {testStatus.testFiles.length} file
                      {testStatus.testFiles.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="p-6 text-center text-gray-600">No test data available</div>
        </Card>
      )}
    </div>
  );
}
