import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { getBusinessMetrics } from "@/lib/monitoring/metrics";

/**
 * GET: Fetch monitoring metrics
 * Returns key business metrics: sales volume, inventory levels, etc.
 * 
 * Query params:
 * - days: Number of days for recent sales calculation (default: 7)
 */
export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7", 10);

    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid days parameter. Must be between 1 and 365.",
        },
        { status: 400 }
      );
    }

    const metrics = await getBusinessMetrics(days);

    return NextResponse.json({
      ok: true,
      metrics,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "get_monitoring_metrics",
    });
  }
}

