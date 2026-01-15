import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, quantity } from "@/lib/validation";

type SoldItemRow = {
  lot_id: string;
  qty: number;
};

type BundleRow = {
  id: string;
  quantity: number;
};

type BundleItemRow = {
  quantity: number;
  bundle_id: string;
};

// POST: Add a lot to an existing bundle
export async function POST(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const logger = createApiLogger(req);

  // Extract bundleId outside try block so it's available in catch
  const { bundleId } = await params;

  try {
    // Validate route parameters
    const validatedBundleId = uuid(bundleId, "bundleId");

    // Validate request body
    const body = await req.json();
    const validatedLotId = uuid(body.lotId, "lotId");
    const validatedQuantity = quantity(body.quantity || 1, "quantity");

    const supabase = supabaseServer();

    // Verify bundle exists and is not sold
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select("id, status, quantity")
      .eq("id", validatedBundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    if (bundle.status === "sold") {
      return NextResponse.json({ error: "Cannot add items to a sold bundle" }, { status: 400 });
    }

    const bundleQuantity = bundle.quantity || 1;

    // Verify the lot exists and is for sale
    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, for_sale, status")
      .eq("id", validatedLotId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    if (!lot.for_sale) {
      return NextResponse.json(
        { error: "Cannot add cards that are not for sale to bundles" },
        { status: 400 }
      );
    }

    // Get quantity already in this bundle (if updating)
    const { data: existingItem } = await supabase
      .from("bundle_items")
      .select("id, quantity")
      .eq("bundle_id", validatedBundleId)
      .eq("lot_id", validatedLotId)
      .single();

    // Check available quantity - account for sold items and existing bundle reservations
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .eq("lot_id", validatedLotId);

    const soldQty = (soldItems || []).reduce(
      (sum: number, item: SoldItemRow) => sum + (item.qty || 0),
      0
    );

    // Get quantities already reserved in other active bundles (excluding this bundle)
    // Reserved = bundle.quantity * bundle_item.quantity
    const { data: activeBundles } = await supabase
      .from("bundles")
      .select("id, quantity")
      .eq("status", "active");

    let reservedQty = 0;
    if (activeBundles && activeBundles.length > 0) {
      const otherBundleIds = activeBundles
        .filter((b: BundleRow) => b.id !== validatedBundleId)
        .map((b: BundleRow) => b.id);

      if (otherBundleIds.length > 0) {
        const bundleQtyMap = new Map<string, number>();
        activeBundles.forEach((b: BundleRow) => {
          if (b.id !== validatedBundleId) {
            bundleQtyMap.set(b.id, b.quantity || 1);
          }
        });

        const { data: existingBundleItems } = await supabase
          .from("bundle_items")
          .select("quantity, bundle_id")
          .eq("lot_id", validatedLotId)
          .in("bundle_id", otherBundleIds);

        reservedQty = (existingBundleItems || []).reduce((sum: number, item: BundleItemRow) => {
          const bundleQty = bundleQtyMap.get(item.bundle_id) || 1;
          return sum + bundleQty * (item.quantity || 1);
        }, 0);
      }
    }

    const currentCardsPerBundle = existingItem?.quantity || 0;
    const currentReservedInThisBundle = bundleQuantity * currentCardsPerBundle;
    const availableQty = lot.quantity - soldQty - reservedQty - currentReservedInThisBundle;

    // For updates: new total = bundleQuantity * newCardsPerBundle
    // For new items: total needed = bundleQuantity * validatedQuantity
    if (existingItem) {
      const newCardsPerBundle = currentCardsPerBundle + validatedQuantity;
      const newTotalNeeded = bundleQuantity * newCardsPerBundle;
      const totalAvailable = availableQty + currentReservedInThisBundle;

      if (newTotalNeeded > totalAvailable) {
        return NextResponse.json(
          {
            error: `Insufficient quantity. Available: ${totalAvailable}, Needed for ${bundleQuantity} bundle(s) with ${newCardsPerBundle} per bundle: ${newTotalNeeded}`,
          },
          { status: 400 }
        );
      }
    } else {
      const totalCardsNeeded = bundleQuantity * validatedQuantity;
      const totalAvailable = availableQty + currentReservedInThisBundle;

      if (totalCardsNeeded > totalAvailable) {
        return NextResponse.json(
          {
            error: `Insufficient quantity. Available: ${totalAvailable}, Needed for ${bundleQuantity} bundle(s) with ${validatedQuantity} per bundle: ${totalCardsNeeded}`,
          },
          { status: 400 }
        );
      }
    }

    if (existingItem) {
      // Update quantity if item already exists
      const newQuantity = existingItem.quantity + validatedQuantity;
      if (newQuantity <= 0) {
        return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from("bundle_items")
        .update({ quantity: newQuantity })
        .eq("id", existingItem.id);

      if (updateError) {
        logger.error("Failed to update bundle item", updateError, undefined, {
          bundleId: validatedBundleId,
          lotId: validatedLotId,
          existingQuantity: existingItem.quantity,
          addedQuantity: validatedQuantity,
        });
        return createErrorResponse(
          updateError.message || "Failed to update bundle item",
          500,
          "UPDATE_BUNDLE_ITEM_FAILED",
          updateError
        );
      }
    } else {
      // Insert new bundle item
      const { error: insertError } = await supabase.from("bundle_items").insert({
        bundle_id: validatedBundleId,
        lot_id: validatedLotId,
        quantity: validatedQuantity,
      });

      if (insertError) {
        logger.error("Failed to add bundle item", insertError, undefined, {
          bundleId: validatedBundleId,
          lotId: validatedLotId,
          quantity: validatedQuantity,
        });
        return createErrorResponse(
          insertError.message || "Failed to add item to bundle",
          500,
          "ADD_BUNDLE_ITEM_FAILED",
          insertError
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Item added to bundle successfully",
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "add_bundle_item",
      metadata: { bundleId },
    });
  }
}
