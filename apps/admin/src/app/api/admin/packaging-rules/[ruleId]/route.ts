import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
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
      console.error("Error updating packaging rule:", ruleError);
      return NextResponse.json(
        { error: ruleError?.message || "Failed to update packaging rule" },
        { status: 500 }
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
        console.error("Error updating packaging rule items:", itemsError);
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
    console.error("Error in update packaging rule API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
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
      console.error("Error deleting packaging rule:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete packaging rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("Error in delete packaging rule API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

