export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

const DELIVERY_COST_KEY = "standard_delivery_cost_gbp";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", DELIVERY_COST_KEY)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine for first time
      throw error;
    }

    const deliveryCostGbp = data?.value ? parseFloat(data.value) : 0;

    return NextResponse.json({
      ok: true,
      deliveryCostGbp,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "get_delivery_cost",
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { deliveryCostGbp } = body;

    if (typeof deliveryCostGbp !== "number" || deliveryCostGbp < 0) {
      return NextResponse.json(
        { error: "deliveryCostGbp must be a non-negative number" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Upsert the delivery cost setting
    const { error } = await supabase.from("app_config").upsert(
      {
        key: DELIVERY_COST_KEY,
        value: deliveryCostGbp.toString(),
        description: "Standard delivery cost in GBP",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      deliveryCostGbp,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "update_delivery_cost",
    });
  }
}
