import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Get count of ready items in inbox using the same view as the inbox page
    // This counts items with status = 'ready' (excluding draft)
    const { count, error } = await supabase
      .from("v_ebay_inbox_lots")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready");

    if (error) {
      console.error("Error fetching inbox count:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch inbox count" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: count || 0,
    });
  } catch (error: any) {
    console.error("Error in inbox count API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

