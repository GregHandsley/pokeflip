import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

const ALLOWED_VARIATIONS = [
  "standard",
  "holo",
  "reverse_holo",
  "first_edition",
  "master_ball",
  "stamped",
  "promo",
  "shadowless",
  "non_holo",
];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { lotId } = await params;
    const body = await req.json();
    const variation = (body?.variation as string | undefined)?.trim() || "standard";

    if (!ALLOWED_VARIATIONS.includes(variation)) {
      return NextResponse.json(
        { error: "Invalid variation" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const { error } = await supabase
      .from("inventory_lots")
      .update({ variation })
      .eq("id", lotId);

    if (error) {
      logger.error("Failed to update variation", error, undefined, { lotId, variation });
      return createErrorResponse(
        error.message || "Failed to update variation",
        500,
        "UPDATE_VARIATION_FAILED",
        error
      );
    }

    return NextResponse.json({ ok: true, variation });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "update_variation", metadata: { lotId } });
  }
}


