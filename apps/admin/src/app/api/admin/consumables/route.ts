import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Get all consumables with their average costs
    const { data: consumables, error } = await supabase
      .from("v_consumable_costs")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching consumables:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch consumables" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      consumables: consumables || [],
    });
  } catch (error: any) {
    console.error("Error in consumables API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, unit = "each" } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: consumable, error } = await supabase
      .from("consumables")
      .insert({
        name: name.trim(),
        unit: unit.trim() || "each",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating consumable:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create consumable" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      consumable,
    });
  } catch (error: any) {
    console.error("Error in create consumable API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


