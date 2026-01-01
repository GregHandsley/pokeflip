import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const consumableId = searchParams.get("consumable_id");

    let query = supabase
      .from("consumable_purchases")
      .select(
        `
        *,
        consumables (
          id,
          name,
          unit
        )
      `
      )
      .order("purchased_at", { ascending: false });

    if (consumableId) {
      query = query.eq("consumable_id", consumableId);
    }

    const { data: purchases, error } = await query;

    if (error) {
      console.error("Error fetching consumable purchases:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch purchases" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      purchases: purchases || [],
    });
  } catch (error: any) {
    console.error("Error in consumable purchases API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { consumable_id, qty, total_cost_pence, purchased_at } = body;

    if (!consumable_id || !qty || total_cost_pence === undefined) {
      return NextResponse.json(
        { error: "consumable_id, qty, and total_cost_pence are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: purchase, error } = await supabase
      .from("consumable_purchases")
      .insert({
        consumable_id,
        qty: parseInt(qty, 10),
        total_cost_pence: Math.round(total_cost_pence),
        purchased_at: purchased_at || new Date().toISOString(),
      })
      .select(
        `
        *,
        consumables (
          id,
          name,
          unit
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating consumable purchase:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create purchase" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      purchase,
    });
  } catch (error: any) {
    console.error("Error in create consumable purchase API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

