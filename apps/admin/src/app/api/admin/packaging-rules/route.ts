import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
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
      console.error("Error fetching packaging rules:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch packaging rules" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rules: rules || [],
    });
  } catch (error: any) {
    console.error("Error in packaging rules API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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
      console.error("Error creating packaging rule:", ruleError);
      return NextResponse.json(
        { error: ruleError?.message || "Failed to create packaging rule" },
        { status: 500 }
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
        console.error("Error creating packaging rule items:", itemsError);
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
    console.error("Error in create packaging rule API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

