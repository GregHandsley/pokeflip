export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createApiLogger } from "@/lib/logger";
import { withResponseTimeTracking } from "@/lib/monitoring/response-time-wrapper";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: {
      status: "healthy" | "unhealthy";
      responseTimeMs?: number;
      error?: string;
    };
    uptime: {
      seconds: number;
    };
  };
  version?: string;
}

const serverStartTime = Date.now();

/**
 * Health check endpoint
 * GET /api/health
 *
 * Returns the health status of the application and its dependencies.
 * Used by monitoring systems to check service availability.
 */
async function healthCheckHandler(req: Request) {
  const logger = createApiLogger(req);

  try {
    const checks: HealthCheckResult["checks"] = {
      database: { status: "unhealthy" },
      uptime: {
        seconds: Math.floor((Date.now() - serverStartTime) / 1000),
      },
    };

    // Check database connection
    const dbStartTime = Date.now();
    const supabase = supabaseServer();
    const { error: dbError } = await supabase.from("healthcheck").select("id").limit(1);
    const dbResponseTime = Date.now() - dbStartTime;

    if (dbError) {
      logger.error("Health check: Database connection failed", dbError, undefined, {
        operation: "health_check",
        check: "database",
      });
      checks.database = {
        status: "unhealthy",
        responseTimeMs: dbResponseTime,
        error: dbError.message,
      };
    } else {
      checks.database = {
        status: "healthy",
        responseTimeMs: dbResponseTime,
      };
    }

    // Determine overall status
    const hasUnhealthyCheck = Object.values(checks).some(
      (check) => "status" in check && check.status === "unhealthy"
    );

    const overallStatus: HealthCheckResult["status"] = hasUnhealthyCheck
      ? "unhealthy"
      : checks.database.responseTimeMs! > 1000
        ? "degraded"
        : "healthy";

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
    };

    // Return appropriate HTTP status code
    const httpStatus = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

    return NextResponse.json(result, { status: httpStatus });
  } catch (error: unknown) {
    logger.error(
      "Health check failed",
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      {
        operation: "health_check",
      }
    );

    const errorResult: HealthCheckResult = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: "unhealthy" },
        uptime: {
          seconds: Math.floor((Date.now() - serverStartTime) / 1000),
        },
      },
    };

    return NextResponse.json(errorResult, { status: 503 });
  }
}

export const GET = withResponseTimeTracking(healthCheckHandler);
