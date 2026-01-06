import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// GET: List all bundles
export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("bundles")
      .select(`
        *,
        bundle_items (
          id,
          quantity,
          inventory_lots (
            id,
            quantity,
            condition,
            variation,
            cards (
              id,
              number,
              name,
              api_image_url,
              sets (
                id,
                name
              )
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: bundles, error } = await query;

    if (error) {
      console.error("Error fetching bundles:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch bundles" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bundles: bundles || [],
    });
  } catch (error: any) {
    console.error("Error in bundles API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new bundle
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, pricePence, items } = body;

    if (!name || !pricePence || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: name, pricePence, and items array" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verify all lots exist and are for sale
    const lotIds = items.map((item: any) => item.lotId);
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, for_sale")
      .in("id", lotIds);

    if (lotsError || !lots || lots.length !== lotIds.length) {
      return NextResponse.json(
        { error: "One or more lots not found" },
        { status: 404 }
      );
    }

    // Check if all lots are for sale
    const notForSaleLots = lots.filter((lot: any) => !lot.for_sale);
    if (notForSaleLots.length > 0) {
      return NextResponse.json(
        { error: "Cannot add cards that are not for sale to bundles" },
        { status: 400 }
      );
    }

    // Create the bundle
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .insert({
        name,
        description: description || null,
        price_pence: pricePence,
        status: "active",
      })
      .select("id")
      .single();

    if (bundleError || !bundle) {
      console.error("Error creating bundle:", bundleError);
      return NextResponse.json(
        { error: bundleError?.message || "Failed to create bundle" },
        { status: 500 }
      );
    }

    // Create bundle items
    const bundleItems = items.map((item: any) => ({
      bundle_id: bundle.id,
      lot_id: item.lotId,
      quantity: item.quantity || 1,
    }));

    const { error: itemsError } = await supabase
      .from("bundle_items")
      .insert(bundleItems);

    if (itemsError) {
      console.error("Error creating bundle items:", itemsError);
      // Rollback bundle creation
      await supabase.from("bundles").delete().eq("id", bundle.id);
      return NextResponse.json(
        { error: itemsError.message || "Failed to create bundle items" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bundle: {
        id: bundle.id,
        name,
        description,
        price_pence: pricePence,
        status: "active",
      },
    });
  } catch (error: any) {
    console.error("Error in create bundle API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

