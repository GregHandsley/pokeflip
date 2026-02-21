export const runtime = "edge";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// A faulty API route to test Sentry's error monitoring.
// Uses dynamic import so Sentry can be tree-shaken when CF_PAGES=1 (Cloudflare build).
export async function GET() {
  const error = new Error("Sentry Example API Route Error - This is a test!");

  if (process.env.CF_PAGES !== "1") {
    const Sentry = await import("@sentry/nextjs");
    logger.error("API route test error", error, undefined, {
      operation: "test_api_error",
      route: "/api/sentry-example-api",
    });
    Sentry.captureException(error, {
      tags: {
        test: "api-route",
        operation: "test_api_error",
      },
    });
    console.log("[API Test] Error captured and sent to Sentry");
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
