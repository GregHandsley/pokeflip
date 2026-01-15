"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useEffect } from "react";

export default function SentryExamplePage() {
  const [error, setError] = useState<Error | null>(null);
  const [sentryStatus, setSentryStatus] = useState<string>("Checking...");

  useEffect(() => {
    // Check if Sentry is initialized
    const checkSentry = () => {
      try {
        const isInitialized = Sentry.getClient() !== undefined;
        setSentryStatus(isInitialized ? "✓ Sentry is initialized" : "✗ Sentry is not initialized");
      } catch {
        setSentryStatus("✗ Error checking Sentry status");
      }
    };
    checkSentry();
  }, []);

  const triggerError = () => {
    const newError = new Error("Sentry Example Frontend Error - This is a test!");
    console.log("[Test] Capturing error to Sentry:", newError);
    Sentry.captureException(newError);
    setError(newError);
  };

  const triggerUndefinedError = () => {
    // This will cause an actual runtime error
    // @ts-expect-error - intentionally calling undefined function
    myUndefinedFunction();
  };

  const triggerApiError = async () => {
    try {
      const response = await fetch("/api/sentry-example-api");
      const data = await response.json();
      console.log("[Test] API Error Response:", data);
      setError(new Error(`API Error: ${data.error || "Unknown error"}`));
    } catch (e) {
      console.error("[Test] Failed to trigger API error:", e);
      setError(e instanceof Error ? e : new Error("Failed to trigger API error"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Sentry Example Page</h1>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-900">
            Status: <span className="font-mono">{sentryStatus}</span>
          </p>
          <p className="text-xs text-blue-700 mt-1">
            DSN: {process.env.NEXT_PUBLIC_SENTRY_DSN ? "✓ Set" : "✗ Missing"}
          </p>
          <p className="text-xs text-blue-700">
            Enabled: {process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true" ? "✓ Yes" : "✗ No"}
          </p>
        </div>
        <p className="text-gray-600 mb-6">
          Click the buttons below to trigger test errors and verify your Sentry integration.
        </p>

        <div className="space-y-4">
          <button
            onClick={triggerError}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Trigger Captured Error
          </button>

          <button
            onClick={triggerUndefinedError}
            className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Trigger Undefined Function Error
          </button>

          <button
            onClick={triggerApiError}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Trigger API Error
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error captured!</p>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
            <p className="text-red-500 text-xs mt-2">
              Check your Sentry dashboard to see this error.
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">What to expect</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Errors should appear in your Sentry dashboard within seconds</li>
            <li>• Each error includes stack traces and context</li>
            <li>• API errors include request details</li>
          </ul>
        </div>

        <div className="mt-6">
          <a href="/admin" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            ← Back to Admin
          </a>
        </div>
      </div>
    </div>
  );
}
