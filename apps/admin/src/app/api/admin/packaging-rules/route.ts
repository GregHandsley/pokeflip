import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  sanitizedNonEmptyString,
  integer,
  min,
  optional,
  boolean,
  array,
  uuid,
  quantity,
} from "@/lib/validation";

type PackagingRuleItem = {
  consumable_id: string;
  qty?: number;
};

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
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_packaging_rules" });
  }
}

export async function POST(req: Request) {
  const logger = createApiLogger(req);

  try {
    const body = await req.json();

    // Validate and sanitize required fields
    const validatedName = sanitizedNonEmptyString(body.name, "name");
    const validatedCardCountMin = min(
      integer(body.card_count_min, "card_count_min"),
      1,
      "card_count_min"
    );

    // Validate optional fields
    const validatedIsDefault = optional(body.is_default, boolean, "is_default") || false;
    const validatedCardCountMax = optional(
      body.card_count_max,
      (v) => min(integer(v, "card_count_max"), validatedCardCountMin, "card_count_max"),
      "card_count_max"
    );
    const validatedItems = optional(body.items, array, "items");

    const supabase = supabaseServer();

    // If setting as default, unset other defaults first
    if (validatedIsDefault) {
      await supabase.from("packaging_rules").update({ is_default: false }).eq("is_default", true);
    }

    // Create the rule
    const { data: rule, error: ruleError } = await supabase
      .from("packaging_rules")
      .insert({
        name: validatedName, // Already sanitized
        is_default: validatedIsDefault,
        card_count_min: validatedCardCountMin,
        card_count_max: validatedCardCountMax || null,
      })
      .select("*")
      .single();

    if (ruleError || !rule) {
      logger.error("Failed to create packaging rule", undefined, {
        name: validatedName,
        card_count_min: validatedCardCountMin,
        error: ruleError,
      });
      return createErrorResponse(
        ruleError?.message || "Failed to create packaging rule",
        500,
        "CREATE_PACKAGING_RULE_FAILED",
        ruleError
      );
    }

    // Add rule items if provided
    if (validatedItems && validatedItems.length > 0) {
      // Validate each item
      validatedItems.forEach((item: PackagingRuleItem, index: number) => {
        uuid(item.consumable_id, `items[${index}].consumable_id`);
        quantity(item.qty || 1, `items[${index}].qty`);
      });

      const ruleItems = validatedItems.map((item: PackagingRuleItem) => ({
        rule_id: rule.id,
        consumable_id: item.consumable_id,
        qty: item.qty || 1,
      }));

      const { error: itemsError } = await supabase.from("packaging_rule_items").insert(ruleItems);

      if (itemsError) {
        logger.warn("Failed to create packaging rule items", undefined, {
          ruleId: rule.id,
          itemsCount: validatedItems.length,
          error: itemsError,
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
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "create_packaging_rule" });
  }
}
