export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import {
  uuid,
  sanitizedNonEmptyString,
  sanitizedString,
  optional,
  nonNegative,
  array,
  number,
  quantity,
} from "@/lib/validation";

type BundleItemRow = {
  id: string;
  quantity: number;
  lot_id: string;
  inventory_lots?: {
    id: string;
    quantity: number;
    card_id: string;
    condition: string;
    variation: string | null;
  } | null;
};

type InventoryLotRow = {
  id: string;
  quantity: number;
  status: string;
  acquisition_id: string | null;
};

type SoldItemRow = {
  lot_id: string;
  qty: number;
};

type SalesOrderData = {
  platform: string;
  buyer_id: string;
  bundle_id: string;
  order_group?: string;
  fees_pence?: number;
  shipping_pence?: number;
  discount_pence?: number;
};

type PurchaseHistoryRow = {
  lot_id: string;
  acquisition_id: string;
  quantity: number;
};

type ConsumableInput = {
  consumable_id: string;
  qty: number | string;
};

// POST: Sell a bundle
export async function POST(req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const logger = createApiLogger(req);
  let validatedBundleId: string = "";

  try {
    // Validate route parameters
    const { bundleId } = await params;
    validatedBundleId = uuid(bundleId, "bundleId");

    // Validate and sanitize request body
    const body = await req.json();
    const validatedBuyerHandle = sanitizedNonEmptyString(body.buyerHandle, "buyerHandle");
    const validatedOrderGroup = optional(
      body.orderGroup,
      (v) => sanitizedString(v, "orderGroup"),
      "orderGroup"
    );
    const validatedFeesPence = optional(
      body.feesPence,
      (v) => nonNegative(number(v, "feesPence"), "feesPence"),
      "feesPence"
    );
    const validatedShippingPence = optional(
      body.shippingPence,
      (v) => nonNegative(number(v, "shippingPence"), "shippingPence"),
      "shippingPence"
    );
    const validatedDiscountPence = optional(
      body.discountPence,
      (v) => nonNegative(number(v, "discountPence"), "discountPence"),
      "discountPence"
    );
    const validatedConsumables = optional(body.consumables, array, "consumables");
    const validatedQuantity = quantity(body.quantity || 1, "quantity"); // Quantity of bundles to sell

    const supabase = supabaseServer();

    // Get bundle with items
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select(
        `
        *,
        bundle_items (
          id,
          quantity,
          lot_id,
          inventory_lots (
            id,
            quantity,
            card_id,
            condition,
            variation
          )
        )
      `
      )
      .eq("id", validatedBundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    if (bundle.status === "sold") {
      return NextResponse.json({ error: "Bundle has already been sold" }, { status: 400 });
    }

    // Check if bundle has enough quantity available
    const bundleQuantity = bundle.quantity || 1;
    if (validatedQuantity > bundleQuantity) {
      return NextResponse.json(
        { error: `Only ${bundleQuantity} bundle(s) available. Requested: ${validatedQuantity}` },
        { status: 400 }
      );
    }

    const bundleItems = bundle.bundle_items || [];
    if (bundleItems.length === 0) {
      return NextResponse.json({ error: "Bundle has no items" }, { status: 400 });
    }

    // Verify all lots have enough available quantity
    const lotIds = bundleItems.map((item: BundleItemRow) => item.lot_id);
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, status, acquisition_id")
      .in("id", lotIds);

    if (lotsError || !lots || lots.length !== lotIds.length) {
      return NextResponse.json({ error: "One or more lots not found" }, { status: 404 });
    }

    // Get current sold quantities
    const { data: existingSales } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lotIds);

    const soldQtyMap = new Map<string, number>();
    (existingSales || []).forEach((item: SoldItemRow) => {
      const current = soldQtyMap.get(item.lot_id) || 0;
      soldQtyMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Verify quantities - cards are already reserved in the bundle, but we need to ensure
    // they haven't been sold individually and that we have enough bundle quantity
    // Total cards needed = validatedQuantity * cards_per_bundle for each item
    for (const bundleItem of bundleItems) {
      const lot = lots.find((l: InventoryLotRow) => l.id === bundleItem.lot_id);
      if (!lot) {
        return NextResponse.json({ error: `Lot ${bundleItem.lot_id} not found` }, { status: 404 });
      }

      const currentSoldQty = soldQtyMap.get(bundleItem.lot_id) || 0;
      const cardsPerBundle = bundleItem.quantity || 1;
      const totalCardsNeeded = validatedQuantity * cardsPerBundle;

      // Cards are reserved in bundle, but check that total available (including reserved) is enough
      // Available = lot.quantity - already_sold
      const totalAvailable = lot.quantity - currentSoldQty;

      if (totalCardsNeeded > totalAvailable) {
        return NextResponse.json(
          {
            error: `Insufficient quantity for lot ${bundleItem.lot_id}. Available: ${totalAvailable}, Needed for ${validatedQuantity} bundle(s): ${totalCardsNeeded} (${cardsPerBundle} per bundle)`,
          },
          { status: 400 }
        );
      }
    }

    // Get or create buyer
    let buyerId: string;
    const { data: existingBuyer } = await supabase
      .from("buyers")
      .select("id")
      .eq("platform", "ebay")
      .eq("handle", validatedBuyerHandle.trim())
      .single();

    if (existingBuyer) {
      buyerId = existingBuyer.id;
    } else {
      const { data: newBuyer, error: buyerError } = await supabase
        .from("buyers")
        .insert({
          platform: "ebay",
          handle: validatedBuyerHandle.trim(),
        })
        .select("id")
        .single();

      if (buyerError || !newBuyer) {
        return NextResponse.json({ error: "Failed to create buyer" }, { status: 500 });
      }
      buyerId = newBuyer.id;
    }

    // Create sales order with bundle_id
    const orderData: SalesOrderData = {
      platform: "ebay",
      buyer_id: buyerId,
      bundle_id: validatedBundleId,
    };

    if (validatedOrderGroup) {
      orderData.order_group = validatedOrderGroup;
    }
    if (validatedFeesPence !== undefined && validatedFeesPence > 0) {
      orderData.fees_pence = validatedFeesPence;
    }
    if (validatedShippingPence !== undefined && validatedShippingPence > 0) {
      orderData.shipping_pence = validatedShippingPence;
    }
    if (validatedDiscountPence !== undefined && validatedDiscountPence > 0) {
      orderData.discount_pence = validatedDiscountPence;
    }

    const { data: salesOrder, error: orderError } = await supabase
      .from("sales_orders")
      .insert(orderData)
      .select("id")
      .single();

    if (orderError || !salesOrder) {
      logger.error("Failed to create sales order for bundle", orderError, undefined, {
        bundleId: validatedBundleId,
        buyerId,
      });
      return createErrorResponse(
        orderError?.message || "Failed to create sales order",
        500,
        "CREATE_SALES_ORDER_FAILED",
        orderError
      );
    }

    // Get purchase history for each lot to maintain purchase tracking
    const { data: purchaseHistory } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, acquisition_id, quantity")
      .in("lot_id", lotIds);

    const purchaseHistoryMap = new Map<
      string,
      Array<{ acquisition_id: string; quantity: number }>
    >();
    (purchaseHistory || []).forEach((ph: PurchaseHistoryRow) => {
      if (!purchaseHistoryMap.has(ph.lot_id)) {
        purchaseHistoryMap.set(ph.lot_id, []);
      }
      purchaseHistoryMap.get(ph.lot_id)!.push({
        acquisition_id: ph.acquisition_id,
        quantity: ph.quantity,
      });
    });

    // Calculate total cards in bundle
    const totalCardsInBundle = bundleItems.reduce(
      (sum: number, item: BundleItemRow) => sum + item.quantity,
      0
    );

    // Calculate price per card (bundle price / total cards)
    // All sales items will use the same price per card
    // Revenue allocation to purchases is handled by purchase allocations
    const pricePerCardPence = Math.round(bundle.price_pence / totalCardsInBundle);

    // Create sales items for each bundle item
    // Each sales item gets the same price per card
    const salesItems: Array<{
      sales_order_id: string;
      lot_id: string;
      qty: number;
      sold_price_pence: number;
    }> = [];

    for (const bundleItem of bundleItems) {
      const lot = lots.find((l: InventoryLotRow) => l.id === bundleItem.lot_id);
      if (!lot) continue;

      // Total quantity sold = number of bundles * cards per bundle
      const totalCardsSold = validatedQuantity * (bundleItem.quantity || 1);

      salesItems.push({
        sales_order_id: salesOrder.id,
        lot_id: bundleItem.lot_id,
        qty: totalCardsSold, // Total cards sold across all bundles
        sold_price_pence: pricePerCardPence, // Same price per card for all items
      });
    }

    const { data: insertedSalesItems, error: itemError } = await supabase
      .from("sales_items")
      .insert(salesItems)
      .select("id, lot_id, qty");

    if (itemError || !insertedSalesItems) {
      logger.error("Failed to create sales items for bundle", itemError, undefined, {
        bundleId: validatedBundleId,
        salesOrderId: salesOrder.id,
        itemsCount: salesItems.length,
      });
      return createErrorResponse(
        "Failed to create sales items",
        500,
        "CREATE_SALES_ITEMS_FAILED",
        itemError
      );
    }

    // Create purchase allocations for each sales item
    // Distribute quantity proportionally based on purchase history
    // The revenue will be calculated proportionally based on these allocations
    const purchaseAllocations: Array<{
      sales_item_id: string;
      acquisition_id: string;
      qty: number;
    }> = [];

    for (let i = 0; i < insertedSalesItems.length; i++) {
      const salesItem = insertedSalesItems[i];
      const bundleItem = bundleItems.find((bi: BundleItemRow) => bi.lot_id === salesItem.lot_id);
      if (!bundleItem) continue;

      const history = purchaseHistoryMap.get(salesItem.lot_id) || [];
      const lot = lots.find((l: InventoryLotRow) => l.id === salesItem.lot_id);
      if (!lot) continue;

      if (history.length > 0) {
        // Distribute sold quantity across purchases proportionally
        const totalFromHistory = history.reduce((sum, h) => sum + h.quantity, 0);
        let remainingQty = salesItem.qty;

        for (let j = 0; j < history.length && remainingQty > 0; j++) {
          const hist = history[j];
          const proportion = hist.quantity / totalFromHistory;
          const allocatedQty =
            j === history.length - 1
              ? remainingQty // Last one gets remaining
              : Math.floor(salesItem.qty * proportion);

          if (allocatedQty > 0) {
            purchaseAllocations.push({
              sales_item_id: salesItem.id,
              acquisition_id: hist.acquisition_id,
              qty: allocatedQty,
            });
            remainingQty -= allocatedQty;
          }
        }
      } else if (lot.acquisition_id) {
        // Fallback: use lot's acquisition_id if no history
        purchaseAllocations.push({
          sales_item_id: salesItem.id,
          acquisition_id: lot.acquisition_id,
          qty: salesItem.qty,
        });
      }
    }

    // Insert purchase allocations
    if (purchaseAllocations.length > 0) {
      console.log(
        `Bundle sell: Creating ${purchaseAllocations.length} purchase allocations:`,
        purchaseAllocations
      );
      const { error: allocError } = await supabase
        .from("sales_item_purchase_allocations")
        .insert(purchaseAllocations);

      if (allocError) {
        logger.warn("Failed to create purchase allocations for bundle sale", undefined, {
          bundleId: validatedBundleId,
          salesOrderId: salesOrder.id,
          allocationsCount: purchaseAllocations.length,
          error: allocError,
        });
        // Don't fail the sale if allocations fail
      } else {
        logger.info(
          `Bundle sell: Successfully created ${purchaseAllocations.length} purchase allocations`,
          undefined,
          {
            bundleId: validatedBundleId,
            salesOrderId: salesOrder.id,
          }
        );
      }
    } else {
      logger.warn("Bundle sell: No purchase allocations created!", undefined, {
        bundleId: validatedBundleId,
      });
    }

    // Create sales consumables if provided
    if (validatedConsumables && validatedConsumables.length > 0) {
      const salesConsumables = validatedConsumables
        .filter((c: ConsumableInput) => {
          if (!c.consumable_id) return false;
          const qty = typeof c.qty === "string" ? parseInt(c.qty, 10) : c.qty;
          return qty > 0;
        })
        .map((c: ConsumableInput) => ({
          sales_order_id: salesOrder.id,
          consumable_id: c.consumable_id,
          qty: typeof c.qty === "string" ? parseInt(c.qty, 10) || 1 : c.qty,
        }));

      if (salesConsumables.length > 0) {
        const { error: consumablesError } = await supabase
          .from("sales_consumables")
          .insert(salesConsumables);

        if (consumablesError) {
          logger.warn("Failed to create sales consumables for bundle", undefined, {
            bundleId: validatedBundleId,
            salesOrderId: salesOrder.id,
            consumablesCount: salesConsumables.length,
            error: consumablesError,
          });
          // Don't fail the sale if consumables fail
        }
      }
    }

    // Update bundle quantity (decrease by sold quantity)
    const newQuantity = bundleQuantity - validatedQuantity;
    if (newQuantity <= 0) {
      // If no bundles left, mark as sold
      await supabase
        .from("bundles")
        .update({ status: "sold", quantity: 0 })
        .eq("id", validatedBundleId);
    } else {
      // Decrease quantity
      await supabase.from("bundles").update({ quantity: newQuantity }).eq("id", validatedBundleId);
    }

    return NextResponse.json({
      ok: true,
      sales_order: {
        id: salesOrder.id,
        bundle_id: validatedBundleId,
      },
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "sell_bundle",
      metadata: { bundleId: validatedBundleId },
    });
  }
}
