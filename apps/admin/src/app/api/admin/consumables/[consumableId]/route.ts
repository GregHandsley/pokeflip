import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ consumableId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { consumableId } = await params;
    const body = await req.json();
    const { name, unit } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: consumable, error } = await supabase
      .from("consumables")
      .update({
        name: name.trim(),
        unit: (unit || "each").trim(),
      })
      .eq("id", consumableId)
      .select("*")
      .single();

    if (error) {
      logger.error("Failed to update consumable", error, undefined, { consumableId, name, unit });
      return createErrorResponse(
        error.message || "Failed to update consumable",
        500,
        "UPDATE_CONSUMABLE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      consumable,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "update_consumable", metadata: { consumableId } });
  }
}


