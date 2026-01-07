import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();

    // Get distinct order numbers
    // Handle case where order_group column might not exist yet (migration not run)
    // Select all orders and filter in JavaScript to avoid errors if column doesn't exist
    const { data: orders, error } = await supabase
      .from("sales_orders")
      .select("order_group");

    if (error) {
      // If column doesn't exist, return empty array instead of error
      if (error.message?.includes("column") && error.message?.includes("does not exist")) {
        logger.warn("order_group column not found, returning empty array");
        return NextResponse.json({
          ok: true,
          orderGroups: [],
        });
      }
      logger.error("Failed to fetch order numbers", error);
      return createErrorResponse(
        error.message || "Failed to fetch order numbers",
        500,
        "FETCH_ORDER_NUMBERS_FAILED",
        error
      );
    }

    // Extract unique order numbers (filter out null/undefined)
    const orderGroups = [
      ...new Set((orders || []).map((o: any) => o.order_group).filter(Boolean)),
    ].sort();

    return NextResponse.json({
      ok: true,
      orderGroups,
    });
  } catch (error: any) {
    // If it's a column error, return empty array
    if (error.message?.includes("column") && error.message?.includes("does not exist")) {
      logger.warn("order_group column not found in catch block, returning empty array");
      return NextResponse.json({
        ok: true,
        orderGroups: [],
      });
    }
    return handleApiError(req, error, { operation: "fetch_order_numbers" });
  }
}

