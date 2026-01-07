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
        logger.error("Test error case", new Error("This is a test error"), undefined, {
          testType: "error",
          timestamp: new Date().toISOString(),
        });
        return createErrorResponse(
          "This is a test error",
          500,
          "TEST_ERROR",
          new Error("This is a test error")
        );

      case "validation":
        logger.warn("Test validation error", undefined, undefined, {
          testType: "validation",
        });
        return createErrorResponse(
          "Validation failed: test field is required",
          400,
          "VALIDATION_ERROR",
          new Error("Validation failed")
        );

      case "log":
        logger.debug("Test debug log", null, undefined, { level: "debug" });
        logger.info("Test info log", null, undefined, { level: "info" });
        logger.warn("Test warning log", null, undefined, { level: "warn" });
        logger.error("Test error log", new Error("Test error"), undefined, { level: "error" });
        return NextResponse.json({
          ok: true,
          message: "All log levels tested. Check server logs.",
          levels: ["debug", "info", "warn", "error"],
        });

      default:
        return createErrorResponse(
          `Unknown test type: ${testType}`,
          400,
          "INVALID_TEST_TYPE"
        );
    }
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "test_error_handling",
      metadata: { testType },
    });
  }
}

