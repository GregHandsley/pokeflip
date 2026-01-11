"use client";

import { useState } from "react";
import { logger } from "@/lib/logger";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useToast } from "@/contexts/ToastContext";
import Button from "@/components/ui/Button";

export default function TestErrorHandlingPage() {
  const [loading, setLoading] = useState(false);
  const { handleError } = useApiErrorHandler();
  const { showSuccess, showError, showInfo, showWarning } = useToast();

  const testApiSuccess = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-error-handling?type=success");
      const json = await res.json();
      if (json.ok) {
        showSuccess(json.message);
      }
    } catch (e) {
      handleError(e, { title: "Failed to test API success" });
    } finally {
      setLoading(false);
    }
  };

  const testApiError = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-error-handling?type=error");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "API error occurred");
      }
    } catch (e) {
      handleError(e, { title: "API Error Test" });
    } finally {
      setLoading(false);
    }
  };

  const testApiValidation = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-error-handling?type=validation");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Validation error occurred");
      }
    } catch (e) {
      handleError(e, { title: "Validation Error Test" });
    } finally {
      setLoading(false);
    }
  };

  const testAllLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-error-handling?type=log");
      const json = await res.json();
      if (json.ok) {
        showSuccess(json.message);
      }
    } catch (e) {
      handleError(e, { title: "Failed to test logs" });
    } finally {
      setLoading(false);
    }
  };

  const testClientLogger = () => {
    logger.debug("Client debug test", undefined, { source: "test-page" });
    logger.info("Client info test", undefined, { source: "test-page" });
    logger.warn("Client warning test", undefined, { source: "test-page" });
    logger.error("Client error test", new Error("Test client error"), undefined, {
      source: "test-page",
    });
    showInfo("Client logger tested. Check browser console.");
  };

  const testToasts = () => {
    showSuccess("This is a success toast!");
    setTimeout(() => showInfo("This is an info toast!"), 500);
    setTimeout(() => showWarning("This is a warning toast!"), 1000);
    setTimeout(() => showError("This is an error toast!"), 1500);
  };

  const testComponentError = () => {
    // This will trigger the ErrorBoundary
    throw new Error("Test component error - ErrorBoundary should catch this!");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Error Handling & Logging Test Page</h1>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3">API Error Handling Tests</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={testApiSuccess} disabled={loading} variant="primary">
              Test API Success
            </Button>
            <Button onClick={testApiError} disabled={loading} variant="secondary">
              Test API Error
            </Button>
            <Button onClick={testApiValidation} disabled={loading} variant="secondary">
              Test Validation Error
            </Button>
            <Button onClick={testAllLogs} disabled={loading} variant="secondary">
              Test All Log Levels
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3">Client-Side Tests</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={testClientLogger} variant="secondary">
              Test Client Logger
            </Button>
            <Button onClick={testToasts} variant="secondary">
              Test Toast Notifications
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3">Error Boundary Test</h2>
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
            <p className="text-sm text-red-700">
              ⚠️ Warning: This will crash the component. The ErrorBoundary should catch it.
            </p>
          </div>
          <Button onClick={testComponentError} variant="secondary" className="bg-red-600 hover:bg-red-700">
            Trigger Component Error
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">What to Check:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Server logs (terminal) - should show structured logs</li>
            <li>Browser console - should show client-side logs</li>
            <li>Toast notifications - should appear and be dismissible</li>
            <li>Error responses - should have proper format with errorCode</li>
            <li>ErrorBoundary - should catch component errors and show fallback UI</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

