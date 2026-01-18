export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";
import { getPackagingConsumablesForCardCount } from "@/lib/packaging/get-packaging-consumables";

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

    const { consumables, ruleName } = await getPackagingConsumablesForCardCount(
      supabase,
      card_count
    );

    if (!ruleName) {
      return NextResponse.json({
        ok: true,
        consumables: [],
        message: "No packaging rule found",
      });
    }

    return NextResponse.json({
      ok: true,
      consumables,
      rule_name: ruleName,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "apply_packaging_rule" });
  }
}
