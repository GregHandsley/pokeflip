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

    // Compute "used" and "in stock" from sales_consumables in case the view hasn't been migrated yet.
    // (This keeps the UI accurate even if the DB view is still the older shape.)
    const { data: salesConsumables, error: salesConsumablesError } = await supabase
      .from("sales_consumables")
      .select("consumable_id, qty");

    if (salesConsumablesError) {
      logger.warn("Failed to fetch sales consumables for stock calc", undefined, {
        error: salesConsumablesError,
      });
    }

    const usedMap = new Map<string, number>();
    (salesConsumables || []).forEach((row: { consumable_id: string; qty: number }) => {
      const current = usedMap.get(row.consumable_id) || 0;
      usedMap.set(row.consumable_id, current + (row.qty || 0));
    });

    // Try to fetch low stock thresholds from consumables table.
    // If the column doesn't exist yet (migration not run), default to 0.
    type ConsumableThresholdRow = {
      id: string;
      low_stock_threshold: number | null;
    };

    type ConsumableCostRow = {
      consumable_id: string;
      name: string;
      unit: string;
      total_purchased_qty: number | null;
      total_cost_pence: number | null;
      avg_cost_pence_per_unit: number | null;
      total_used_qty?: number | null;
      in_stock_qty?: number | null;
      low_stock_threshold?: number | null;
    };

    const thresholdMap = new Map<string, number>();
    const thresholdRes = await supabase.from("consumables").select("id, low_stock_threshold");
    if (!thresholdRes.error && thresholdRes.data) {
      thresholdRes.data.forEach((row: ConsumableThresholdRow) => {
        thresholdMap.set(String(row.id), Number(row.low_stock_threshold ?? 0));
      });
    }

    const enriched = (consumables || []).map((c: ConsumableCostRow) => {
      const purchased = Number(c.total_purchased_qty || 0);
      const usedFromSales = usedMap.get(String(c.consumable_id)) || 0;
      const totalUsed =
        c.total_used_qty != null ? Number(c.total_used_qty || 0) : Number(usedFromSales || 0);
      const inStock =
        c.in_stock_qty != null ? Number(c.in_stock_qty || 0) : Math.max(0, purchased - totalUsed);
      const threshold =
        c.low_stock_threshold != null
          ? Number(c.low_stock_threshold ?? 0)
          : Number(thresholdMap.get(String(c.consumable_id)) ?? 0);

      return {
        ...c,
        total_used_qty: totalUsed,
        in_stock_qty: inStock,
        low_stock_threshold: threshold,
        is_out_of_stock: inStock <= 0,
        is_low_stock: inStock > 0 && threshold > 0 && inStock <= threshold,
      };
    });

    return NextResponse.json({
      ok: true,
      consumables: enriched,
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
