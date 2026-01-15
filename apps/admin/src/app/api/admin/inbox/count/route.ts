import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const supabase = supabaseServer();

    // Get count of ready items in inbox using the same view as the inbox page
    // This counts items with status = 'ready' (excluding draft)
    const { count, error } = await supabase
      .from("v_ebay_inbox_lots")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready");

    if (error) {
      logger.error("Failed to fetch inbox count", error);
      return createErrorResponse(
        error.message || "Failed to fetch inbox count",
        500,
        "FETCH_INBOX_COUNT_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      count: count || 0,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_inbox_count" });
  }
}
