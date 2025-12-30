import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const setId = searchParams.get("setId");
    const q = searchParams.get("q") || "";
    const rarity = searchParams.get("rarity");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 200);
    const sort = searchParams.get("sort") || "name";

    const supabase = supabaseServer();
    
    // Try to query the new view structure first
    let query = supabase.from("v_card_inventory_totals").select("*", { count: "exact" });

    // Filters
    if (setId) {
      query = query.eq("set_id", setId);
    }
    if (rarity) {
      query = query.eq("rarity", rarity);
    }
    if (q) {
      // Search in card_name and card_number columns (from new migration)
      // Supabase .or() format: "column1.ilike.value,column2.ilike.value"
      // Note: % wildcards are included in the value
      query = query.or(`card_name.ilike.%${q}%,card_number.ilike.%${q}%`);
    }

    // Sorting - use new column names from migration
    const sortColumn = sort === "set" ? "set_id" : 
                      sort === "qty_on_hand" ? "qty_on_hand" :
                      sort === "updated_at" ? "updated_at_max" :
                      "card_name";
    const ascending = sort === "qty_on_hand" ? false : true;
    query = query.order(sortColumn, { ascending });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    
    // Check for specific column errors that indicate migration issue
    if (error) {
      const errorMsg = error.message || "";
      const errorCode = (error as any).code;
      console.error("Error fetching inventory cards:", error);
      console.error("Error message:", errorMsg);
      console.error("Error code:", errorCode);
      console.error("Error details:", JSON.stringify(error, null, 2));
      
      // Check for specific column errors that indicate migration issue
      // Only trigger if the error specifically mentions these columns don't exist
      const isMissingColumnError = errorCode === "42703" || // undefined_column
                                  (errorMsg.includes("column") && 
                                   errorMsg.includes("does not exist") &&
                                   (errorMsg.includes("card_name") || 
                                    errorMsg.includes("card_number") || 
                                    errorMsg.includes("qty_on_hand") ||
                                    errorMsg.includes("set_name")));
      
      if (isMissingColumnError) {
        return NextResponse.json(
          { 
            error: "Database migration required. Please run: supabase migration up --include-all",
            migrationRequired: true,
            details: process.env.NODE_ENV === "development" ? {
              message: error.message,
              code: errorCode,
              hint: (error as any).hint
            } : undefined
          },
          { status: 500 }
        );
      }
      
      // Other errors - return the actual error
      return NextResponse.json(
        { 
          error: error.message || "Failed to fetch cards",
          details: process.env.NODE_ENV === "development" ? {
            message: error.message,
            code: errorCode,
            hint: (error as any).hint,
            fullError: error
          } : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error: any) {
    console.error("Error in inventory cards API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

