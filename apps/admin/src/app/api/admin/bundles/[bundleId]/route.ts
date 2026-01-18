export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  sanitizedNonEmptyString,
  sanitizedString,
  pricePence,
  optional,
  bundleStatus,
  quantity,
} from "@/lib/validation";

type BundleItemRow = {
  id: string;
  lot_id: string;
  quantity: number;
};

type InventoryLotRow = {
  id: string;
  quantity: number;
};

type SoldItemRow = {
  lot_id: string;
  qty: number;
};

type BundleRow = {
  id: string;
  quantity: number;
};

type UpdateBundleData = {
  name?: string;
  description?: string | null;
  price_pence?: number;
  status?: string;
  quantity?: number;
};

// GET: Get a single bundle with items
export async function GET(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  // Extract bundleId outside try block so it's available in catch
  const { bundleId } = await params;

  try {
    const supabase = supabaseServer();

    const { data: bundle, error } = await supabase
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
      .eq("id", bundleId)
      .single();

    if (error || !bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      bundle,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_bundle", metadata: { bundleId } });
  }
}

// PATCH: Update bundle details
export async function PATCH(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const logger = createApiLogger(req);

  // Extract bundleId outside try block so it's available in catch
  const { bundleId } = await params;

  try {
    const body = await req.json();
    const supabase = supabaseServer();

    // Verify bundle exists with items
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select(
        `
        id,
        status,
        quantity,
        bundle_items (
          id,
          lot_id,
          quantity
        )
      `
      )
      .eq("id", bundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    if (bundle.status === "sold") {
      return NextResponse.json({ error: "Cannot modify a sold bundle" }, { status: 400 });
    }

    // Build update object with validated and sanitized fields
    const updateData: UpdateBundleData = {};

    if (body.name !== undefined) {
      updateData.name = sanitizedNonEmptyString(body.name, "name");
    }

    if (body.description !== undefined) {
      updateData.description =
        optional(body.description, (v) => sanitizedString(v, "description"), "description") || null;
    }

    if (body.pricePence !== undefined) {
      updateData.price_pence = pricePence(body.pricePence, "pricePence");
    }

    if (body.status !== undefined) {
      updateData.status = bundleStatus(body.status, "status");
    }

    // Handle quantity update - validate if increasing
    if (body.quantity !== undefined) {
      const newQuantity = quantity(body.quantity, "quantity");
      const currentQuantity = bundle.quantity || 1;

      // If increasing quantity, validate that enough cards are available
      if (newQuantity > currentQuantity) {
        const bundleItems = bundle.bundle_items || [];
        const lotIds = bundleItems.map((item: BundleItemRow) => item.lot_id);

        // Get current lots with sold quantities
        const { data: lots } = await supabase
          .from("inventory_lots")
          .select("id, quantity")
          .in("id", lotIds);

        const { data: soldItems } = await supabase
          .from("sales_items")
          .select("lot_id, qty")
          .in("lot_id", lotIds);

        const soldItemsMap = new Map<string, number>();
        (soldItems || []).forEach((item: SoldItemRow) => {
          const current = soldItemsMap.get(item.lot_id) || 0;
          soldItemsMap.set(item.lot_id, current + (item.qty || 0));
        });

        // Get quantities reserved in other active bundles
        const { data: activeBundles } = await supabase
          .from("bundles")
          .select("id, quantity")
          .eq("status", "active");

        const bundleReservedMap = new Map<string, number>();
        if (activeBundles && activeBundles.length > 0) {
          const otherBundleIds = activeBundles
            .filter((b: BundleRow) => b.id !== bundleId)
            .map((b: BundleRow) => b.id);

          if (otherBundleIds.length > 0) {
            const bundleQtyMap = new Map<string, number>();
            activeBundles.forEach((b: BundleRow) => {
              if (b.id !== bundleId) {
                bundleQtyMap.set(b.id, b.quantity || 1);
              }
            });

            const { data: otherBundleItems } = await supabase
              .from("bundle_items")
              .select("lot_id, quantity, bundle_id")
              .in("lot_id", lotIds)
              .in("bundle_id", otherBundleIds);

            (otherBundleItems || []).forEach(
              (item: { lot_id: string; quantity: number; bundle_id: string }) => {
                const bundleQty = bundleQtyMap.get(item.bundle_id) || 1;
                const totalReserved = bundleQty * (item.quantity || 1);
                const current = bundleReservedMap.get(item.lot_id) || 0;
                bundleReservedMap.set(item.lot_id, current + totalReserved);
              }
            );
          }
        }

        // Validate each bundle item has enough available
        const quantityIncrease = newQuantity - currentQuantity;
        for (const bundleItem of bundleItems) {
          const lot = (lots || []).find((l: InventoryLotRow) => l.id === bundleItem.lot_id);
          if (!lot) continue;

          const soldQty = soldItemsMap.get(bundleItem.lot_id) || 0;
          const reservedInOtherBundles = bundleReservedMap.get(bundleItem.lot_id) || 0;
          const cardsReservedInThisBundle = currentQuantity * (bundleItem.quantity || 1);
          const availableQty =
            lot.quantity - soldQty - reservedInOtherBundles - cardsReservedInThisBundle;
          const cardsNeeded = quantityIncrease * (bundleItem.quantity || 1);

          if (cardsNeeded > availableQty) {
            return NextResponse.json(
              {
                error: `Cannot increase bundle quantity. Insufficient cards for lot. Available: ${availableQty}, Needed for ${quantityIncrease} more bundle(s): ${cardsNeeded} (${bundleItem.quantity || 1} per bundle)`,
              },
              { status: 400 }
            );
          }
        }
      }

      updateData.quantity = newQuantity;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("bundles")
      .update(updateData)
      .eq("id", bundleId);

    if (updateError) {
      logger.error("Failed to update bundle", updateError, undefined, { bundleId, updateData });
      return createErrorResponse(
        updateError.message || "Failed to update bundle",
        500,
        "UPDATE_BUNDLE_FAILED",
        updateError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bundle updated successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "update_bundle", metadata: { bundleId } });
  }
}

// DELETE: Delete a bundle
export async function DELETE(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const logger = createApiLogger(req);
  let bundleId: string = "";

  try {
    const resolved = await params;
    bundleId = resolved.bundleId;
    const supabase = supabaseServer();

    // Check if bundle has been sold
    const { data: salesOrders } = await supabase
      .from("sales_orders")
      .select("id")
      .eq("bundle_id", bundleId)
      .limit(1);

    if (salesOrders && salesOrders.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete bundle that has been sold" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("bundles").delete().eq("id", bundleId);

    if (error) {
      logger.error("Failed to delete bundle", error, undefined, { bundleId });
      return createErrorResponse(
        error.message || "Failed to delete bundle",
        500,
        "DELETE_BUNDLE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bundle deleted successfully",
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "delete_bundle", metadata: { bundleId } });
  }
}
