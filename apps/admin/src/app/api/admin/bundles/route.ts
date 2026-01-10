import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  nonEmptyString,
  pricePence,
  nonEmptyArray,
  uuid,
  quantity,
  optional,
  string,
  bundleStatus,
} from "@/lib/validation";

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

    // Only filter by status if provided and not "all"
    if (status && status !== "all") {
      const validatedStatus = bundleStatus(status, "status");
      query = query.eq("status", validatedStatus);
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
  let body: any;
  
  try {
    body = await req.json();
    
    // Validate required fields
    const validatedName = nonEmptyString(body.name, "name");
    const validatedPricePence = pricePence(body.pricePence, "pricePence");
    const validatedItems = nonEmptyArray(body.items, "items");
    const validatedBundleQuantity = quantity(body.quantity || 1, "quantity");
    
    // Validate each item in the array
    validatedItems.forEach((item: any, index: number) => {
      uuid(item.lotId, `items[${index}].lotId`);
      quantity(item.quantity || 1, `items[${index}].quantity`);
    });
    
    const validatedDescription = optional(body.description, string, "description");

    const supabase = supabaseServer();

    // Verify all lots exist and are for sale
    const lotIds = validatedItems.map((item: any) => item.lotId);
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, for_sale, status")
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

    // Check available quantities - account for sold items and existing bundle reservations
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lotIds);

    const soldItemsMap = new Map<string, number>();
    (soldItems || []).forEach((item: any) => {
      const current = soldItemsMap.get(item.lot_id) || 0;
      soldItemsMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Get quantities already reserved in other active bundles
    const { data: activeBundles } = await supabase
      .from("bundles")
      .select("id")
      .eq("status", "active");

    const bundleReservedMap = new Map<string, number>();
    if (activeBundles && activeBundles.length > 0) {
      const activeBundleIds = activeBundles.map((b: any) => b.id);
      
      const { data: existingBundleItems } = await supabase
        .from("bundle_items")
        .select("lot_id, quantity")
        .in("lot_id", lotIds)
        .in("bundle_id", activeBundleIds);

      (existingBundleItems || []).forEach((item: any) => {
        const current = bundleReservedMap.get(item.lot_id) || 0;
        bundleReservedMap.set(item.lot_id, current + (item.quantity || 0));
      });
    }

    // Validate each item has enough available quantity
    // Total cards needed = bundle_quantity * cards_per_bundle for each item
    for (const item of validatedItems) {
      const lot = lots.find((l: any) => l.id === item.lotId);
      if (!lot) continue;

      const soldQty = soldItemsMap.get(item.lotId) || 0;
      const reservedQty = bundleReservedMap.get(item.lotId) || 0;
      const cardsPerBundle = item.quantity || 1;
      const totalCardsNeeded = validatedBundleQuantity * cardsPerBundle;
      const availableQty = lot.quantity - soldQty - reservedQty;

      if (availableQty < totalCardsNeeded) {
        return NextResponse.json(
          { 
            error: `Insufficient quantity for lot ${item.lotId}. Available: ${availableQty}, Needed for ${validatedBundleQuantity} bundle(s): ${totalCardsNeeded} (${cardsPerBundle} per bundle)` 
          },
          { status: 400 }
        );
      }
    }

    // Create the bundle
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .insert({
        name: validatedName,
        description: validatedDescription || null,
        price_pence: validatedPricePence,
        quantity: validatedBundleQuantity,
        status: "active",
      })
      .select("id")
      .single();

    if (bundleError || !bundle) {
      logger.error("Failed to create bundle", bundleError, undefined, {
        name: validatedName,
        pricePence: validatedPricePence,
      });
      return createErrorResponse(
        bundleError?.message || "Failed to create bundle",
        500,
        "CREATE_BUNDLE_FAILED",
        bundleError
      );
    }

    // Create bundle items
    const bundleItems = validatedItems.map((item: any) => ({
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
        name: validatedName,
        description: validatedDescription,
        price_pence: validatedPricePence,
        quantity: validatedBundleQuantity,
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

