import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { sanitizedNonEmptyString, optional } from "@/lib/validation";

export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const supabase = supabaseServer();

    // Get all consumables with their average costs
    const { data: consumables, error } = await supabase
      .from("v_consumable_costs")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      logger.error("Failed to fetch consumables", error);
      return createErrorResponse(
        error.message || "Failed to fetch consumables",
        500,
        "FETCH_CONSUMABLES_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      consumables: consumables || [],
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_consumables" });
  }
}

export async function POST(req: Request) {
  const logger = createApiLogger(req);

  try {
    const body = await req.json();

    // Validate and sanitize required fields
    const validatedName = sanitizedNonEmptyString(body.name, "name");
    const validatedUnit =
      optional(body.unit, (v) => sanitizedNonEmptyString(v, "unit"), "unit") || "each";

    const supabase = supabaseServer();

    const { data: consumable, error } = await supabase
      .from("consumables")
      .insert({
        name: validatedName, // Already sanitized
        unit: validatedUnit, // Already sanitized
      })
      .select("*")
      .single();

    if (error) {
      logger.error("Failed to create consumable", error, undefined, {
        name: validatedName,
        unit: validatedUnit,
      });
      return createErrorResponse(
        error.message || "Failed to create consumable",
        500,
        "CREATE_CONSUMABLE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      consumable,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "create_consumable" });
  }
}
