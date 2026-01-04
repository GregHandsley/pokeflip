import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";
    
    const supabase = supabaseServer();

    let query = supabase
      .from("promotional_deals")
      .select("*");
    
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    
    const { data: deals, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching promotional deals:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch promotional deals" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deals: deals || [],
    });
  } catch (error: any) {
    console.error("Error in promotional deals API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      deal_type,
      discount_percent,
      discount_amount_pence,
      buy_quantity,
      get_quantity,
      min_card_count,
      max_card_count,
      is_active,
    } = body;

    if (!name || !deal_type) {
      return NextResponse.json(
        { error: "Missing required fields: name, deal_type" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: deal, error } = await supabase
      .from("promotional_deals")
      .insert({
        name,
        description,
        deal_type,
        discount_percent: discount_percent ? parseFloat(discount_percent) : null,
        discount_amount_pence: discount_amount_pence ? parseInt(discount_amount_pence, 10) : null,
        buy_quantity: buy_quantity ? parseInt(buy_quantity, 10) : null,
        get_quantity: get_quantity ? parseInt(get_quantity, 10) : null,
        min_card_count: min_card_count ? parseInt(min_card_count, 10) : 1,
        max_card_count: max_card_count ? parseInt(max_card_count, 10) : null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating promotional deal:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create promotional deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deal,
    });
  } catch (error: any) {
    console.error("Error in create promotional deal API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

