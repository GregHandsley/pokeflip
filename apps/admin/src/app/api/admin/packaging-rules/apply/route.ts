import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

type ConsumableRow = {
  id: string;
  name: string;
  unit: string;
};

type PackagingRuleItemRow = {
  id: string;
  consumable_id: string;
  qty: number;
  consumables: ConsumableRow | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { card_count } = body;

    if (card_count === undefined || card_count < 1) {
      return NextResponse.json(
        { error: "card_count is required and must be >= 1" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Find the matching packaging rule
    // First try to find a specific rule, then fall back to default
    const { data: specificRule } = await supabase
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
      .lte("card_count_min", card_count)
      .or(`card_count_max.is.null,card_count_max.gte.${card_count}`)
      .order("card_count_min", { ascending: false })
      .limit(1)
      .single();

    let rule = specificRule;

    // If no specific rule found, use default
    if (!rule) {
      const { data: defaultRule } = await supabase
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
        .eq("is_default", true)
        .single();

      rule = defaultRule;
    }

    if (!rule) {
      return NextResponse.json({
        ok: true,
        consumables: [],
        message: "No packaging rule found",
      });
    }

    // Format the consumables list
    const consumables = (rule.packaging_rule_items || []).map((item: PackagingRuleItemRow) => ({
      consumable_id: item.consumable_id,
      consumable_name: item.consumables?.name || "",
      qty: item.qty,
      unit: item.consumables?.unit || "each",
    }));

    return NextResponse.json({
      ok: true,
      consumables,
      rule_name: rule.name,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "apply_packaging_rule" });
  }
}
