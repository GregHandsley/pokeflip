import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, quantity } from "@/lib/validation";

// PATCH: Update bundle item quantity
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bundleId: string; itemId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { bundleId, itemId } = await params;
    const validatedBundleId = uuid(bundleId, "bundleId");
    const validatedItemId = uuid(itemId, "itemId");
    
    const body = await req.json();
    const validatedQuantity = quantity(body.quantity, "quantity");

    const supabase = supabaseServer();

    // Verify bundle exists and is not sold
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select("id, status, quantity")
      .eq("id", validatedBundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    if (bundle.status === "sold") {
      return NextResponse.json(
        { error: "Cannot modify items in a sold bundle" },
        { status: 400 }
      );
    }

    const bundleQuantity = bundle.quantity || 1;

    // Get the bundle item with lot information
    const { data: bundleItem, error: itemError } = await supabase
      .from("bundle_items")
      .select("id, lot_id, quantity, inventory_lots(id, quantity, for_sale)")
      .eq("id", validatedItemId)
      .eq("bundle_id", validatedBundleId)
      .single();

    if (itemError || !bundleItem) {
      return NextResponse.json(
        { error: "Bundle item not found" },
        { status: 404 }
      );
    }

    const lot = bundleItem.inventory_lots;
    if (!lot || !lot.for_sale) {
      return NextResponse.json(
        { error: "Cannot update items that are not for sale" },
        { status: 400 }
      );
    }

    // Check available quantity - account for sold items and existing bundle reservations
    const { data: soldItems } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .eq("lot_id", bundleItem.lot_id);

    const soldQty = (soldItems || []).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);

    // Get quantities already reserved in other active bundles (excluding this bundle)
    // Reserved = bundle.quantity * bundle_item.quantity
    const { data: activeBundles } = await supabase
      .from("bundles")
      .select("id, quantity")
      .eq("status", "active");

    let reservedQty = 0;
    if (activeBundles && activeBundles.length > 0) {
      const otherBundleIds = activeBundles
        .filter((b: any) => b.id !== validatedBundleId)
        .map((b: any) => b.id);
      
      if (otherBundleIds.length > 0) {
        const bundleQtyMap = new Map<string, number>();
        activeBundles.forEach((b: any) => {
          if (b.id !== validatedBundleId) {
            bundleQtyMap.set(b.id, b.quantity || 1);
          }
        });
        
        const { data: existingBundleItems } = await supabase
          .from("bundle_items")
          .select("quantity, bundle_id")
          .eq("lot_id", bundleItem.lot_id)
          .in("bundle_id", otherBundleIds);

        reservedQty = (existingBundleItems || []).reduce((sum: number, item: any) => {
          const bundleQty = bundleQtyMap.get(item.bundle_id) || 1;
          return sum + (bundleQty * (item.quantity || 1));
        }, 0);
      }
    }

    const currentCardsPerBundle = bundleItem.quantity;
    const currentReservedInThisBundle = bundleQuantity * currentCardsPerBundle;
    const availableQty = lot.quantity - soldQty - reservedQty - currentReservedInThisBundle;

    // New total needed = bundleQuantity * validatedQuantity (cards per bundle)
    const newTotalNeeded = bundleQuantity * validatedQuantity;
    const totalAvailable = availableQty + currentReservedInThisBundle;

    if (newTotalNeeded > totalAvailable) {
      return NextResponse.json(
        { error: `Insufficient quantity. Available: ${totalAvailable}, Needed for ${bundleQuantity} bundle(s) with ${validatedQuantity} per bundle: ${newTotalNeeded}` },
        { status: 400 }
      );
    }

    // Update the bundle item
    const { error: updateError } = await supabase
      .from("bundle_items")
      .update({ quantity: validatedQuantity })
      .eq("id", validatedItemId);

    if (updateError) {
      logger.error("Failed to update bundle item", updateError, undefined, {
        bundleId: validatedBundleId,
        itemId: validatedItemId,
        newQuantity: validatedQuantity,
      });
      return createErrorResponse(
        updateError.message || "Failed to update bundle item",
        500,
        "UPDATE_BUNDLE_ITEM_FAILED",
        updateError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bundle item updated successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "update_bundle_item",
      metadata: { bundleId, itemId },
    });
  }
}

// DELETE: Remove bundle item
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bundleId: string; itemId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { bundleId, itemId } = await params;
    const validatedBundleId = uuid(bundleId, "bundleId");
    const validatedItemId = uuid(itemId, "itemId");

    const supabase = supabaseServer();

    // Verify bundle exists and is not sold
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select("id, status")
      .eq("id", validatedBundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    if (bundle.status === "sold") {
      return NextResponse.json(
        { error: "Cannot delete items from a sold bundle" },
        { status: 400 }
      );
    }

    // Verify bundle item exists and belongs to this bundle
    const { data: bundleItem, error: itemError } = await supabase
      .from("bundle_items")
      .select("id")
      .eq("id", validatedItemId)
      .eq("bundle_id", validatedBundleId)
      .single();

    if (itemError || !bundleItem) {
      return NextResponse.json(
        { error: "Bundle item not found" },
        { status: 404 }
      );
    }

    // Delete the bundle item
    const { error: deleteError } = await supabase
      .from("bundle_items")
      .delete()
      .eq("id", validatedItemId);

    if (deleteError) {
      logger.error("Failed to delete bundle item", deleteError, undefined, {
        bundleId: validatedBundleId,
        itemId: validatedItemId,
      });
      return createErrorResponse(
        deleteError.message || "Failed to delete bundle item",
        500,
        "DELETE_BUNDLE_ITEM_FAILED",
        deleteError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bundle item deleted successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "delete_bundle_item",
      metadata: { bundleId, itemId },
    });
  }
}

