import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  uuid,
  nonEmptyString,
  sanitizedNonEmptyString,
  integer,
  min,
  optional,
  boolean,
  array,
  quantity,
} from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    // Validate route parameters
    const { ruleId } = await params;
    const validatedRuleId = uuid(ruleId, "ruleId");
    
    // Validate and sanitize request body
    const body = await req.json();
    const validatedName = optional(body.name, (v) => sanitizedNonEmptyString(v, "name"), "name");
    const validatedIsDefault = optional(body.is_default, boolean, "is_default");
    const validatedCardCountMin = optional(body.card_count_min, (v) => min(integer(v, "card_count_min"), 1, "card_count_min"), "card_count_min");
    const validatedCardCountMax = optional(body.card_count_max, (v) => min(integer(v, "card_count_max"), validatedCardCountMin || 1, "card_count_max"), "card_count_max");
    const validatedItems = optional(body.items, array, "items");
    
    // At least one field must be provided
    if (!validatedName && validatedIsDefault === undefined && validatedCardCountMin === undefined && validatedCardCountMax === undefined && !validatedItems) {
      return createErrorResponse(
        "At least one field must be provided for update",
        400,
        "NO_UPDATE_FIELDS"
      );
    }

    const supabase = supabaseServer();

    // Build update object with only provided fields
    const updateData: any = {};
    if (validatedName) updateData.name = validatedName; // Already sanitized
    if (validatedIsDefault !== undefined) updateData.is_default = validatedIsDefault;
    if (validatedCardCountMin !== undefined) updateData.card_count_min = validatedCardCountMin;
    if (validatedCardCountMax !== undefined) updateData.card_count_max = validatedCardCountMax;

    // If setting as default, unset other defaults first
    if (validatedIsDefault === true) {
      await supabase
        .from("packaging_rules")
        .update({ is_default: false })
        .eq("is_default", true)
        .neq("id", validatedRuleId);
    }

    // Update the rule
    const { data: rule, error: ruleError } = await supabase
      .from("packaging_rules")
      .update(updateData)
      .eq("id", validatedRuleId)
      .select("*")
      .single();

    if (ruleError || !rule) {
      logger.error("Failed to update packaging rule", ruleError, undefined, {
        ruleId: validatedRuleId,
        name: validatedName,
      });
      return createErrorResponse(
        ruleError?.message || "Failed to update packaging rule",
        500,
        "UPDATE_PACKAGING_RULE_FAILED",
        ruleError
      );
    }

    // Delete existing rule items if items are being updated
    if (validatedItems) {
      await supabase
        .from("packaging_rule_items")
        .delete()
        .eq("rule_id", validatedRuleId);

      // Add new rule items if provided
      if (validatedItems.length > 0) {
        // Validate each item
        validatedItems.forEach((item: any, index: number) => {
          uuid(item.consumable_id, `items[${index}].consumable_id`);
          quantity(item.qty || 1, `items[${index}].qty`);
        });
        
        const ruleItems = validatedItems.map((item: any) => ({
          rule_id: validatedRuleId,
          consumable_id: item.consumable_id,
          qty: item.qty || 1,
        }));

      const { error: itemsError } = await supabase
        .from("packaging_rule_items")
        .insert(ruleItems);

        if (itemsError) {
          logger.error("Failed to update packaging rule items", itemsError, undefined, {
            ruleId: validatedRuleId,
            itemsCount: validatedItems.length,
          });
        return NextResponse.json(
          { error: itemsError.message || "Failed to update rule items" },
          { status: 500 }
        );
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
      .eq("id", validatedRuleId)
      .single();

    return NextResponse.json({
      ok: true,
      rule: completeRule,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "update_packaging_rule",
      metadata: { ruleId: validatedRuleId },
    });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    // Validate route parameters
    const { ruleId } = await params;
    const validatedRuleId = uuid(ruleId, "ruleId");

    const supabase = supabaseServer();

    // Delete rule items first (cascade should handle this, but being explicit)
    await supabase
      .from("packaging_rule_items")
      .delete()
      .eq("rule_id", validatedRuleId);

    // Delete the rule
    const { error } = await supabase
      .from("packaging_rules")
      .delete()
      .eq("id", validatedRuleId);

    if (error) {
      logger.error("Failed to delete packaging rule", error, undefined, {
        ruleId: validatedRuleId,
      });
      return createErrorResponse(
        error.message || "Failed to delete packaging rule",
        500,
        "DELETE_PACKAGING_RULE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "delete_packaging_rule",
      metadata: { ruleId: validatedRuleId },
    });
  }
}


