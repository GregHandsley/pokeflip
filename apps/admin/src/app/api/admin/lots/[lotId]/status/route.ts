import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const validStatuses = ["draft", "ready", "listed", "sold", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Update the lot status
    const { error } = await supabase
      .from("inventory_lots")
      .update({ status })
      .eq("id", lotId);

    if (error) {
      logger.error("Failed to update lot status", error, undefined, { lotId, status });
      return createErrorResponse(
        error.message || "Failed to update lot status",
        500,
        "UPDATE_LOT_STATUS_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Lot status updated to ${status}`,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "update_lot_status", metadata: { lotId } });
  }
}

