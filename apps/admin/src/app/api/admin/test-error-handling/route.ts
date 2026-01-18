export const runtime = "edge";
import { NextResponse } from "next/server";
import { createApiLogger } from "@/lib/logger";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";

/**
 * Test endpoint for error handling and logging
 *
 * Usage:
 * GET /api/admin/test-error-handling?type=success - Returns success
 * GET /api/admin/test-error-handling?type=error - Returns a test error
 * GET /api/admin/test-error-handling?type=validation - Returns validation error
 * GET /api/admin/test-error-handling?type=log - Tests all log levels
 */
export async function GET(req: Request) {
  const logger = createApiLogger(req);
  const { searchParams } = new URL(req.url);
  const testType = searchParams.get("type") || "success";

  try {
    switch (testType) {
      case "success":
        logger.info("Test success case");
        return NextResponse.json({
          ok: true,
          message: "Success! Check server logs for info message.",
        });

      case "error":
        logger.error("Test error case", undefined, {
          testType: "error",
          timestamp: new Date().toISOString(),
          error: new Error("This is a test error"),
        });
        return createErrorResponse(
          "This is a test error",
          500,
          "TEST_ERROR",
          new Error("This is a test error")
        );

      case "validation":
        logger.warn("Test validation error", undefined, {
          testType: "validation",
        });
        return createErrorResponse(
          "Validation failed: test field is required",
          400,
          "VALIDATION_ERROR",
          new Error("Validation failed")
        );

      case "log":
        logger.debug("Test debug log", undefined, { level: "debug" });
        logger.info("Test info log", undefined, { level: "info" });
        logger.warn("Test warning log", undefined, { level: "warn" });
        logger.error("Test error log", undefined, {
          level: "error",
          error: new Error("Test error"),
        });
        return NextResponse.json({
          ok: true,
          message: "All log levels tested. Check server logs.",
          levels: ["debug", "info", "warn", "error"],
        });

      default:
        return createErrorResponse(`Unknown test type: ${testType}`, 400, "INVALID_TEST_TYPE");
    }
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "test_error_handling",
      metadata: { testType },
    });
  }
}
