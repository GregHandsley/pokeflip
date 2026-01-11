import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { runAllIntegrityChecks, checkOrphanedRecords, checkQuantityConsistency, validateProfitCalculations } from "@/lib/integrity";

/**
 * GET /api/admin/integrity/check
 * 
 * Run all integrity checks or a specific check
 * Query parameters:
 * - check: Optional. Specific check to run ('orphaned', 'quantities', 'profit', or omit for all)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const checkType = url.searchParams.get("check");

    let result;

    if (checkType === "orphaned") {
      result = await checkOrphanedRecords();
      return NextResponse.json({
        ok: true,
        check: result,
      });
    } else if (checkType === "quantities") {
      result = await checkQuantityConsistency();
      return NextResponse.json({
        ok: true,
        check: result,
      });
    } else if (checkType === "profit") {
      result = await validateProfitCalculations();
      return NextResponse.json({
        ok: true,
        check: result,
      });
    } else {
      // Run all checks
      const report = await runAllIntegrityChecks();
      return NextResponse.json({
        ok: true,
        report,
      });
    }
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "integrity_check",
    });
  }
}

/**
 * POST /api/admin/integrity/check
 * 
 * Run all integrity checks (alternative to GET)
 */
export async function POST(req: Request) {
  try {
    const report = await runAllIntegrityChecks();
    return NextResponse.json({
      ok: true,
      report,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "integrity_check",
    });
  }
}

