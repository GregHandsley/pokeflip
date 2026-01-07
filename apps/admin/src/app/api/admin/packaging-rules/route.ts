import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();

    // Get all packaging rules with their items
    const { data: rules, error } = await supabase
      .from("packaging_rules")
      .select(
        `
        *,
        packaging_rule_items (
          id,
          consumable_id,
          qty,
          consumables (
            id,
            name,
            unit
          )
        )
      `
      )
      .order("is_default", { ascending: false })
      .order("card_count_min", { ascending: true });

    if (error) {
      logger.error("Failed to fetch packaging rules", error);
      return createErrorResponse(
        error.message || "Failed to fetch packaging rules",
        500,
        "FETCH_PACKAGING_RULES_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      rules: rules || [],
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_packaging_rules" });
  }
}

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const body = await req.json();
    const { name, is_default, card_count_min, card_count_max, items } = body;

    if (!name || card_count_min === undefined) {
      return NextResponse.json(
        { error: "name and card_count_min are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from("packaging_rules")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    // Create the rule
    const { data: rule, error: ruleError } = await supabase
      .from("packaging_rules")
      .insert({
        name: name.trim(),
        is_default: is_default || false,
        card_count_min: parseInt(card_count_min, 10),
        card_count_max: card_count_max ? parseInt(card_count_max, 10) : null,
      })
      .select("*")
      .single();

    if (ruleError || !rule) {
      logger.error("Failed to create packaging rule", ruleError, undefined, { name, card_count_min });
      return createErrorResponse(
        ruleError?.message || "Failed to create packaging rule",
        500,
        "CREATE_PACKAGING_RULE_FAILED",
        ruleError
      );
    }

    // Add rule items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const ruleItems = items.map((item: any) => ({
        rule_id: rule.id,
        consumable_id: item.consumable_id,
        qty: parseInt(item.qty, 10) || 1,
      }));

      const { error: itemsError } = await supabase
        .from("packaging_rule_items")
        .insert(ruleItems);

      if (itemsError) {
        logger.warn("Failed to create packaging rule items", itemsError, undefined, {
          ruleId: rule.id,
          itemsCount: items.length,
        });
        // Don't fail the whole request, just log the error
      }
    }

    // Fetch the complete rule with items
    const { data: completeRule } = await supabase
      .from("packaging_rules")
      .select(
        `
        *,
        packaging_rule_items (
          id,
          consumable_id,
          qty,
          consumables (
            id,
            name,
            unit
          )
        )
      `
      )
      .eq("id", rule.id)
      .single();

    return NextResponse.json({
      ok: true,
      rule: completeRule,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "create_packaging_rule" });
  }
}


