import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function PATCH(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);
  const { lotId } = await params;

  try {
    const body = await req.json();
    const { use_api_image } = body;

    if (typeof use_api_image !== "boolean") {
      return NextResponse.json({ error: "use_api_image must be a boolean" }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Update the lot
    const { error } = await supabase
      .from("inventory_lots")
      .update({ use_api_image })
      .eq("id", lotId);

    if (error) {
      logger.error("Failed to update use_api_image flag", error, undefined, {
        lotId,
        use_api_image,
      });
      return createErrorResponse(
        error.message || "Failed to update use_api_image flag",
        500,
        "UPDATE_USE_API_IMAGE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: `API image flag ${use_api_image ? "enabled" : "disabled"}`,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "update_use_api_image", metadata: { lotId } });
  }
}
