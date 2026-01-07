import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// A faulty API route to test Sentry's error monitoring
export function GET() {
  const error = new Error("Sentry Example API Route Error - This is a test!");
  
  // Log to our custom logger (which also sends to Sentry)
  logger.error("API route test error", error, undefined, {
    operation: "test_api_error",
    route: "/api/sentry-example-api",
  });
  
  // Also capture directly with Sentry
  Sentry.captureException(error, {
    tags: {
      test: "api-route",
      operation: "test_api_error",
    },
  });
  
  console.log("[API Test] Error captured and sent to Sentry");
  
  return NextResponse.json({ error: error.message }, { status: 500 });
}

