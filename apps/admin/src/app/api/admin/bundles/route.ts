export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  sanitizedNonEmptyString,
  sanitizedString,
  pricePence,
  nonEmptyArray,
  uuid,
  quantity,
  optional,
  bundleStatus,
} from "@/lib/validation";

type BundleItemInput = {
  lotId: string;
  quantity?: number;
};

type CreateBundleRequestBody = {
  name: string;
  pricePence: number;
  items: BundleItemInput[];
  quantity?: number;
  description?: string;
};

type InventoryLotRow = {
  id: string;
  quantity: number;
  for_sale: boolean;
  status: string;
};

type SoldItemRow = {
  lot_id: string;
  qty: number;
};

type BundleRow = {
  id: string;
};

type BundleItemRow = {
  lot_id: string;
  quantity: number;
};

// GET: List all bundles
export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("bundles")
      .select(
        `
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
      `
      )
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
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "fetch_bundles" });
  }
}

// POST: Create a new bundle
export async function POST(req: Request) {
  const logger = createApiLogger(req);

  try {
    const body = (await req.json()) as CreateBundleRequestBody;

    // Validate and sanitize required fields
    const validatedName = sanitizedNonEmptyString(body.name, "name");
    const validatedPricePence = pricePence(body.pricePence, "pricePence");
    const validatedItems = nonEmptyArray(body.items, "items") as BundleItemInput[];
    const validatedBundleQuantity = quantity(body.quantity || 1, "quantity");

    // Validate each item in the array
    validatedItems.forEach((item: BundleItemInput, index: number) => {
      uuid(item.lotId, `items[${index}].lotId`);
      quantity(item.quantity || 1, `items[${index}].quantity`);
    });

    // Sanitize optional description
    const validatedDescription = optional(
      body.description,
      (v) => sanitizedString(v, "description"),
      "description"
    );

    const supabase = supabaseServer();

    // Verify all lots exist and are for sale
    const lotIds = validatedItems.map((item: BundleItemInput) => item.lotId);
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, for_sale, status")
      .in("id", lotIds);

    if (lotsError || !lots || lots.length !== lotIds.length) {
      return NextResponse.json({ error: "One or more lots not found" }, { status: 404 });
    }

    // Check if all lots are for sale
    const notForSaleLots = lots.filter((lot: InventoryLotRow) => !lot.for_sale);
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
    (soldItems || []).forEach((item: SoldItemRow) => {
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
      const activeBundleIds = activeBundles.map((b: BundleRow) => b.id);

      const { data: existingBundleItems } = await supabase
        .from("bundle_items")
        .select("lot_id, quantity")
        .in("lot_id", lotIds)
        .in("bundle_id", activeBundleIds);

      (existingBundleItems || []).forEach((item: BundleItemRow) => {
        const current = bundleReservedMap.get(item.lot_id) || 0;
        bundleReservedMap.set(item.lot_id, current + (item.quantity || 0));
      });
    }

    // Validate each item has enough available quantity
    // Total cards needed = bundle_quantity * cards_per_bundle for each item
    for (const item of validatedItems) {
      const bundleItem: BundleItemInput = item;
      const lot = lots.find((l: InventoryLotRow) => l.id === bundleItem.lotId);
      if (!lot) continue;

      const soldQty = soldItemsMap.get(bundleItem.lotId) || 0;
      const reservedQty = bundleReservedMap.get(bundleItem.lotId) || 0;
      const cardsPerBundle = bundleItem.quantity || 1;
      const totalCardsNeeded = validatedBundleQuantity * cardsPerBundle;
      const availableQty = lot.quantity - soldQty - reservedQty;

      if (availableQty < totalCardsNeeded) {
        return NextResponse.json(
          {
            error: `Insufficient quantity for lot ${bundleItem.lotId}. Available: ${availableQty}, Needed for ${validatedBundleQuantity} bundle(s): ${totalCardsNeeded} (${cardsPerBundle} per bundle)`,
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
    const bundleItems = validatedItems.map((item: BundleItemInput) => ({
      bundle_id: bundle.id,
      lot_id: item.lotId,
      quantity: item.quantity || 1,
    }));

    const { error: itemsError } = await supabase.from("bundle_items").insert(bundleItems);

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
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "create_bundle",
    });
  }
}
