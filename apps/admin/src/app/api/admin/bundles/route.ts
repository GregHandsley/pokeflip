import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

// GET: List all bundles
export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
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
      logger.error("Failed to fetch bundles", error);
      return createErrorResponse(
        error.message || "Failed to fetch bundles",
        500,
        "FETCH_BUNDLES_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      bundles: bundles || [],
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "fetch_bundles" });
  }
}

// POST: Create a new bundle
export async function POST(req: Request) {
  const logger = createApiLogger(req);
  
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
      logger.error("Failed to create bundle", bundleError, undefined, { name, pricePence });
      return createErrorResponse(
        bundleError?.message || "Failed to create bundle",
        500,
        "CREATE_BUNDLE_FAILED",
        bundleError
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
      logger.error("Failed to create bundle items", itemsError, undefined, {
        bundleId: bundle.id,
        itemsCount: bundleItems.length,
      });
      // Rollback bundle creation
      await supabase.from("bundles").delete().eq("id", bundle.id);
      return createErrorResponse(
        itemsError.message || "Failed to create bundle items",
        500,
        "CREATE_BUNDLE_ITEMS_FAILED",
        itemsError
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
    return handleApiError(req, error, {
      operation: "create_bundle",
      metadata: { body },
    });
  }
}

