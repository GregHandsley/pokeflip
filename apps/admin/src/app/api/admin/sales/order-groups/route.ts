import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Get distinct order numbers
    // Handle case where order_group column might not exist yet (migration not run)
    // Select all orders and filter in JavaScript to avoid errors if column doesn't exist
    const { data: orders, error } = await supabase
      .from("sales_orders")
      .select("order_group");

    if (error) {
      // If column doesn't exist, return empty array instead of error
      if (error.message?.includes("column") && error.message?.includes("does not exist")) {
        console.warn("order_group column not found, returning empty array");
        return NextResponse.json({
          ok: true,
          orderGroups: [],
        });
      }
      console.error("Error fetching order numbers:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch order numbers" },
        { status: 500 }
      );
    }

    // Extract unique order numbers (filter out null/undefined)
    const orderGroups = [
      ...new Set((orders || []).map((o: any) => o.order_group).filter(Boolean)),
    ].sort();

    return NextResponse.json({
      ok: true,
      orderGroups,
    });
  } catch (error: any) {
    console.error("Error in order numbers API:", error);
    // If it's a column error, return empty array
    if (error.message?.includes("column") && error.message?.includes("does not exist")) {
      return NextResponse.json({
        ok: true,
        orderGroups: [],
      });
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

