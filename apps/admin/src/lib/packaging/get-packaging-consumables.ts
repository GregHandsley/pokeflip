import type { SupabaseClient } from "@supabase/supabase-js";

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

type PackagingRuleRow = {
  id: string;
  name: string;
  is_default: boolean;
  card_count_min: number;
  card_count_max: number | null;
  packaging_rule_items?: PackagingRuleItemRow[] | null;
};

export type PackagingConsumable = {
  consumable_id: string;
  consumable_name: string;
  qty: number;
  unit: string;
};

export async function getPackagingConsumablesForCardCount(
  supabase: SupabaseClient,
  cardCount: number
): Promise<{ consumables: PackagingConsumable[]; ruleName: string | null }> {
  if (!Number.isFinite(cardCount) || cardCount < 1) {
    return { consumables: [], ruleName: null };
  }

  const select = `
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
  `;

  // Prefer the most specific rule that matches cardCount
  const { data: specificRule } = await supabase
    .from("packaging_rules")
    .select(select)
    .lte("card_count_min", cardCount)
    .or(`card_count_max.is.null,card_count_max.gte.${cardCount}`)
    .order("card_count_min", { ascending: false })
    .limit(1)
    .single();

  let rule: PackagingRuleRow | null = (specificRule as PackagingRuleRow | null) || null;

  // Fall back to default
  if (!rule) {
    const { data: defaultRule } = await supabase
      .from("packaging_rules")
      .select(select)
      .eq("is_default", true)
      .single();
    rule = (defaultRule as PackagingRuleRow | null) || null;
  }

  if (!rule) {
    return { consumables: [], ruleName: null };
  }

  const consumables = (rule.packaging_rule_items || []).map((item) => ({
    consumable_id: item.consumable_id,
    consumable_name: item.consumables?.name || "",
    qty: item.qty,
    unit: item.consumables?.unit || "each",
  }));

  return { consumables, ruleName: rule.name || null };
}
