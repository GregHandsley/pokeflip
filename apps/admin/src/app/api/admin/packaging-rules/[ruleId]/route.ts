import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { ruleId } = await params;
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
        .eq("is_default", true)
        .neq("id", ruleId);
    }

    // Update the rule
    const { data: rule, error: ruleError } = await supabase
      .from("packaging_rules")
      .update({
        name: name.trim(),
        is_default: is_default || false,
        card_count_min: parseInt(card_count_min, 10),
        card_count_max: card_count_max ? parseInt(card_count_max, 10) : null,
      })
      .eq("id", ruleId)
      .select("*")
      .single();

    if (ruleError || !rule) {
      logger.error("Failed to update packaging rule", ruleError, undefined, { ruleId, name });
      return createErrorResponse(
        ruleError?.message || "Failed to update packaging rule",
        500,
        "UPDATE_PACKAGING_RULE_FAILED",
        ruleError
      );
    }

    // Delete existing rule items
    await supabase
      .from("packaging_rule_items")
      .delete()
      .eq("rule_id", ruleId);

    // Add new rule items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const ruleItems = items.map((item: any) => ({
        rule_id: ruleId,
        consumable_id: item.consumable_id,
        qty: parseInt(item.qty, 10) || 1,
      }));

      const { error: itemsError } = await supabase
        .from("packaging_rule_items")
        .insert(ruleItems);

      if (itemsError) {
        logger.error("Failed to update packaging rule items", itemsError, undefined, {
          ruleId,
          itemsCount: items.length,
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
      .eq("id", ruleId)
      .single();

    return NextResponse.json({
      ok: true,
      rule: completeRule,
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "update_packaging_rule", metadata: { ruleId } });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;

    const supabase = supabaseServer();

    // Delete rule items first (cascade should handle this, but being explicit)
    await supabase
      .from("packaging_rule_items")
      .delete()
      .eq("rule_id", ruleId);

    // Delete the rule
    const { error } = await supabase
      .from("packaging_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      logger.error("Failed to delete packaging rule", error, undefined, { ruleId });
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
  } catch (error: any) {
    return handleApiError(req, error, { operation: "delete_packaging_rule", metadata: { ruleId } });
  }
}


