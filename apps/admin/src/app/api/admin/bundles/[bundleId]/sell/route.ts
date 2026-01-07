import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

// POST: Sell a bundle
export async function POST(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { bundleId } = await params;
    const body = await req.json();
    const {
      buyerHandle,
      orderGroup,
      feesPence,
      shippingPence,
      discountPence,
      consumables,
    } = body;

    if (!buyerHandle) {
      return NextResponse.json(
        { error: "Missing required field: buyerHandle" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Get bundle with items
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select(`
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
      `)
      .eq("id", bundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    if (bundle.status === "sold") {
      return NextResponse.json(
        { error: "Bundle has already been sold" },
        { status: 400 }
      );
    }

    const bundleItems = bundle.bundle_items || [];
    if (bundleItems.length === 0) {
      return NextResponse.json(
        { error: "Bundle has no items" },
        { status: 400 }
      );
    }

    // Verify all lots have enough available quantity
    const lotIds = bundleItems.map((item: any) => item.lot_id);
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, status")
      .in("id", lotIds);

    if (lotsError || !lots || lots.length !== lotIds.length) {
      return NextResponse.json(
        { error: "One or more lots not found" },
        { status: 404 }
      );
    }

    // Get current sold quantities
    const { data: existingSales } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lotIds);

    const soldQtyMap = new Map<string, number>();
    (existingSales || []).forEach((item: any) => {
      const current = soldQtyMap.get(item.lot_id) || 0;
      soldQtyMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Verify quantities
    for (const bundleItem of bundleItems) {
      const lot = lots.find((l: any) => l.id === bundleItem.lot_id);
      if (!lot) {
        return NextResponse.json(
          { error: `Lot ${bundleItem.lot_id} not found` },
          { status: 404 }
        );
      }

      const currentSoldQty = soldQtyMap.get(bundleItem.lot_id) || 0;
      const availableQty = lot.quantity - currentSoldQty;

      if (bundleItem.quantity > availableQty) {
        return NextResponse.json(
          { error: `Only ${availableQty} items available for lot ${bundleItem.lot_id}` },
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
      .eq("handle", buyerHandle.trim())
      .single();

    if (existingBuyer) {
      buyerId = existingBuyer.id;
    } else {
      const { data: newBuyer, error: buyerError } = await supabase
        .from("buyers")
        .insert({
          platform: "ebay",
          handle: buyerHandle.trim(),
        })
        .select("id")
        .single();

      if (buyerError || !newBuyer) {
        return NextResponse.json(
          { error: "Failed to create buyer" },
          { status: 500 }
        );
      }
      buyerId = newBuyer.id;
    }

    // Create sales order with bundle_id
    const orderData: any = {
      platform: "ebay",
      buyer_id: buyerId,
      bundle_id: bundleId,
    };

    if (orderGroup && orderGroup.trim()) {
      orderData.order_group = orderGroup.trim();
    }
    if (feesPence != null && feesPence > 0) {
      orderData.fees_pence = feesPence;
    }
    if (shippingPence != null && shippingPence > 0) {
      orderData.shipping_pence = shippingPence;
    }
    if (discountPence != null && discountPence > 0) {
      orderData.discount_pence = discountPence;
    }

    const { data: salesOrder, error: orderError } = await supabase
      .from("sales_orders")
      .insert(orderData)
      .select("id")
      .single();

    if (orderError || !salesOrder) {
      logger.error("Failed to create sales order for bundle", orderError, undefined, {
        bundleId,
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

    const purchaseHistoryMap = new Map<string, Array<{ acquisition_id: string; quantity: number }>>();
    (purchaseHistory || []).forEach((ph: any) => {
      if (!purchaseHistoryMap.has(ph.lot_id)) {
        purchaseHistoryMap.set(ph.lot_id, []);
      }
      purchaseHistoryMap.get(ph.lot_id)!.push({
        acquisition_id: ph.acquisition_id,
        quantity: ph.quantity,
      });
    });

    // Calculate total cards in bundle
    const totalCardsInBundle = bundleItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    
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
      const lot = lots.find((l: any) => l.id === bundleItem.lot_id);
      if (!lot) continue;

      salesItems.push({
        sales_order_id: salesOrder.id,
        lot_id: bundleItem.lot_id,
        qty: bundleItem.quantity,
        sold_price_pence: pricePerCardPence, // Same price per card for all items
      });
    }

    const { data: insertedSalesItems, error: itemError } = await supabase
      .from("sales_items")
      .insert(salesItems)
      .select("id, lot_id, qty");

    if (itemError || !insertedSalesItems) {
      logger.error("Failed to create sales items for bundle", itemError, undefined, {
        bundleId,
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
      const bundleItem = bundleItems.find((bi: any) => bi.lot_id === salesItem.lot_id);
      if (!bundleItem) continue;

      const history = purchaseHistoryMap.get(salesItem.lot_id) || [];
      const lot = lots.find((l: any) => l.id === salesItem.lot_id);
      if (!lot) continue;

      if (history.length > 0) {
        // Distribute sold quantity across purchases proportionally
        const totalFromHistory = history.reduce((sum, h) => sum + h.quantity, 0);
        let remainingQty = salesItem.qty;

        for (let j = 0; j < history.length && remainingQty > 0; j++) {
          const hist = history[j];
          const proportion = hist.quantity / totalFromHistory;
          const allocatedQty = j === history.length - 1
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
      console.log(`Bundle sell: Creating ${purchaseAllocations.length} purchase allocations:`, purchaseAllocations);
      const { error: allocError } = await supabase
        .from("sales_item_purchase_allocations")
        .insert(purchaseAllocations);

      if (allocError) {
        logger.warn("Failed to create purchase allocations for bundle sale", allocError, undefined, {
          bundleId,
          salesOrderId: salesOrder.id,
          allocationsCount: purchaseAllocations.length,
        });
        // Don't fail the sale if allocations fail
      } else {
        logger.info(`Bundle sell: Successfully created ${purchaseAllocations.length} purchase allocations`, undefined, {
          bundleId,
          salesOrderId: salesOrder.id,
        });
      }
    } else {
      console.warn("Bundle sell: No purchase allocations created!");
    }

    // Create sales consumables if provided
    if (consumables && Array.isArray(consumables) && consumables.length > 0) {
      const salesConsumables = consumables
        .filter((c: any) => c.consumable_id && c.qty > 0)
        .map((c: any) => ({
          sales_order_id: salesOrder.id,
          consumable_id: c.consumable_id,
          qty: parseInt(c.qty, 10) || 1,
        }));

      if (salesConsumables.length > 0) {
        const { error: consumablesError } = await supabase
          .from("sales_consumables")
          .insert(salesConsumables);

        if (consumablesError) {
          logger.warn("Failed to create sales consumables for bundle", consumablesError, undefined, {
            bundleId,
            salesOrderId: salesOrder.id,
            consumablesCount: salesConsumables.length,
          });
          // Don't fail the sale if consumables fail
        }
      }
    }

    // Update bundle status to sold
    await supabase
      .from("bundles")
      .update({ status: "sold" })
      .eq("id", bundleId);

    return NextResponse.json({
      ok: true,
      sales_order: {
        id: salesOrder.id,
        bundle_id: bundleId,
      },
    });
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "sell_bundle",
      metadata: { bundleId, body },
    });
  }
}

