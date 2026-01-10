import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { logAudit, getCurrentUser } from "@/lib/audit";
import {
  nonEmptyString,
  sanitizedNonEmptyString,
  sanitizedString,
  optional,
  nonNegative,
  array,
  uuid,
  quantity,
  pricePence,
  number,
} from "@/lib/validation";

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  let body: any;
  
  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);
  
  try {
    body = await req.json();
    
    // Validate and sanitize buyer handle (required)
    const validatedBuyerHandle = sanitizedNonEmptyString(body.buyerHandle, "buyerHandle");
    
    // Support both old format (lotId + qty) and new format (lots array)
    let lotsToSell: Array<{ lotId: string; qty: number }> = [];
    
    if (body.lots && Array.isArray(body.lots)) {
      // New format: array of lots - validate each item
      const validatedLots = array(body.lots, "lots");
      validatedLots.forEach((l: any, index: number) => {
        uuid(l.lotId, `lots[${index}].lotId`);
        quantity(l.qty, `lots[${index}].qty`);
        // Price is optional per lot in new format
        if (l.pricePence !== undefined && l.pricePence !== null) {
          pricePence(l.pricePence, `lots[${index}].pricePence`);
        }
      });
      lotsToSell = validatedLots.map((l: any) => ({
        lotId: l.lotId,
        qty: l.qty,
      }));
    } else if (body.lotId && body.qty) {
      // Legacy format: single lot
      const validatedLotId = uuid(body.lotId, "lotId");
      const validatedQty = quantity(body.qty, "qty");
      lotsToSell = [{ lotId: validatedLotId, qty: validatedQty }];
    } else {
      return createErrorResponse(
        "Missing required fields: either (lotId + qty) or (lots array)",
        400,
        "MISSING_FIELDS"
      );
    }

    // Validate: either soldPricePence (old format) or lots with prices (new format)
    const hasNewFormat = body.lots && Array.isArray(body.lots) && body.lots.some((l: any) => l.pricePence != null);
    const hasOldFormat = body.soldPricePence != null;
    
    if (!hasNewFormat && !hasOldFormat) {
      return createErrorResponse(
        "Missing required fields: either soldPricePence or lots with pricePence",
        400,
        "MISSING_PRICE"
      );
    }
    
    // Validate old format price if provided
    let validatedSoldPricePence: number | undefined = undefined;
    if (hasOldFormat && body.soldPricePence != null) {
      validatedSoldPricePence = pricePence(body.soldPricePence, "soldPricePence");
    }
    
    // Validate optional fields
    const validatedOrderGroup = optional(body.orderGroup, (v) => sanitizedString(v, "orderGroup"), "orderGroup");
    const validatedFeesPence = optional(body.feesPence, (v) => nonNegative(number(v, "feesPence"), "feesPence"), "feesPence");
    const validatedShippingPence = optional(body.shippingPence, (v) => nonNegative(number(v, "shippingPence"), "shippingPence"), "shippingPence");
    const validatedDiscountPence = optional(body.discountPence, (v) => nonNegative(number(v, "discountPence"), "discountPence"), "discountPence");
    const validatedConsumables = optional(body.consumables, array, "consumables");
    
    // Validate consumables if provided
    if (validatedConsumables) {
      validatedConsumables.forEach((c: any, index: number) => {
        uuid(c.consumable_id, `consumables[${index}].consumable_id`);
        quantity(c.qty, `consumables[${index}].qty`);
      });
    }

    const supabase = supabaseServer();

    // Verify all lots exist and have enough available quantity
    const lotIds = lotsToSell.map((l) => l.lotId);
    const { data: lotsData, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, status, for_sale, list_price_pence")
      .in("id", lotIds);

    if (lotsError || !lotsData || lotsData.length !== lotIds.length) {
      return NextResponse.json(
        { error: "One or more lots not found" },
        { status: 404 }
      );
    }

    // Get current sold quantities for all lots
    const { data: existingSales } = await supabase
      .from("sales_items")
      .select("lot_id, qty")
      .in("lot_id", lotIds);

    const soldQtyMap = new Map<string, number>();
    (existingSales || []).forEach((item: any) => {
      const current = soldQtyMap.get(item.lot_id) || 0;
      soldQtyMap.set(item.lot_id, current + (item.qty || 0));
    });

    // Get quantities reserved in active bundles
    const { data: activeBundles } = await supabase
      .from("bundles")
      .select("id")
      .eq("status", "active");

    const bundleReservedMap = new Map<string, number>();
    if (activeBundles && activeBundles.length > 0) {
      const activeBundleIds = activeBundles.map((b: any) => b.id);
      
      const { data: bundleItems } = await supabase
        .from("bundle_items")
        .select("lot_id, quantity")
        .in("lot_id", lotIds)
        .in("bundle_id", activeBundleIds);

      (bundleItems || []).forEach((item: any) => {
        const current = bundleReservedMap.get(item.lot_id) || 0;
        bundleReservedMap.set(item.lot_id, current + (item.quantity || 0));
      });
    }

    // Verify quantities for each lot
    for (const lotToSell of lotsToSell) {
      const lot = lotsData.find((l: any) => l.id === lotToSell.lotId);
      if (!lot) {
        return NextResponse.json(
          { error: `Lot ${lotToSell.lotId} not found` },
          { status: 404 }
        );
      }

      const currentSoldQty = soldQtyMap.get(lotToSell.lotId) || 0;
      const bundleReservedQty = bundleReservedMap.get(lotToSell.lotId) || 0;
      const availableQty = lot.quantity - currentSoldQty - bundleReservedQty;

      if (lotToSell.qty > availableQty) {
        const errorMsg = bundleReservedQty > 0
          ? `Only ${availableQty} items available for lot ${lotToSell.lotId} (${bundleReservedQty} reserved in bundles)`
          : `Only ${availableQty} items available for lot ${lotToSell.lotId}`;
        return NextResponse.json(
          { error: errorMsg },
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
        return NextResponse.json(
          { error: "Failed to create buyer" },
          { status: 500 }
        );
      }
      buyerId = newBuyer.id;
    }

    // Create sales order
    // Build insert object - only include fields that exist in the schema
    // Since migration may not be run, we'll try with optional fields first,
    // then fall back to required fields only if there's a column error
    const orderData: any = {
      platform: "ebay",
      buyer_id: buyerId,
    };
    
    // Only add optional fields if they have values (we'll handle column errors separately)
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

    let { data: salesOrder, error: orderError } = await supabase
      .from("sales_orders")
      .insert(orderData)
      .select("id")
      .single();

    // If error is due to missing columns (PGRST204 = column not found), retry without optional fields
    if (orderError) {
      const errorCode = (orderError as any).code;
      const errorMessage = orderError.message || "";
      const isColumnError = 
        errorCode === "PGRST204" ||
        errorMessage.includes("column") && 
        (errorMessage.includes("does not exist") || 
         errorMessage.includes("Could not find") ||
         errorMessage.includes("fees_pence") ||
         errorMessage.includes("shipping_pence") ||
         errorMessage.includes("order_group"));
      
      if (isColumnError) {
        logger.warn("Optional columns not found, creating order without them", undefined, {
          code: errorCode,
          message: errorMessage,
        });
        // Retry with only required fields
        const basicOrderData = {
          platform: "ebay",
          buyer_id: buyerId,
        };
        const retryResult = await supabase
          .from("sales_orders")
          .insert(basicOrderData)
          .select("id")
          .single();
        
        salesOrder = retryResult.data;
        orderError = retryResult.error;
      }
    }

    if (orderError || !salesOrder) {
      logger.error("Failed to create sales order", orderError, undefined, {
        orderError: orderError?.message,
        buyerId,
      });
      return createErrorResponse(
        orderError?.message || "Failed to create sales order",
        500,
        "ORDER_CREATE_FAILED",
        orderError
      );
    }

    // Support both old format (single soldPricePence for all) and new format (price per lot)
    // New format: lots array with { lotId, qty, pricePence, purchaseAllocations? }
    // Old format: soldPricePence is total, calculate per unit
    let salesItems: Array<{ sales_order_id: string; lot_id: string; qty: number; sold_price_pence: number; purchase_id?: string | null }>;
    const purchaseAllocationsMap = new Map<string, Array<{ purchaseId: string; qty: number }>>();
    
    if (body.lots && Array.isArray(body.lots) && body.lots.some((l: any) => l.pricePence != null)) {
      // New format: individual prices per lot
      salesItems = lotsToSell.map((lotToSell, index) => {
        const lotData = body.lots[index];
        const pricePence = lotData?.pricePence ?? body.soldPricePence ?? 0;
        const purchaseId = lotData?.purchaseId || null; // Legacy single purchase
        const purchaseAllocations = lotData?.purchaseAllocations || null;
        
        // Store allocations for later insertion
        if (purchaseAllocations && purchaseAllocations.length > 0) {
          // We'll insert these after creating the sales_item
          purchaseAllocationsMap.set(lotToSell.lotId, purchaseAllocations);
        }
        
        return {
          sales_order_id: salesOrder.id,
          lot_id: lotToSell.lotId,
          qty: lotToSell.qty,
          sold_price_pence: pricePence, // Price per unit for this lot
          purchase_id: purchaseId || null, // Legacy: single purchase attribution
        };
      });
    } else {
      // Old format: single price for all items
      if (!validatedSoldPricePence) {
        return createErrorResponse(
          "soldPricePence is required for legacy format",
          400,
          "MISSING_PRICE"
        );
      }
      const totalQty = lotsToSell.reduce((sum, lot) => sum + lot.qty, 0);
      const pricePerUnitPence = totalQty > 0 ? Math.round(validatedSoldPricePence / totalQty) : 0;
      
      salesItems = lotsToSell.map((lotToSell) => ({
        sales_order_id: salesOrder.id,
        lot_id: lotToSell.lotId,
        qty: lotToSell.qty,
        sold_price_pence: pricePerUnitPence,
        purchase_id: null, // No purchase attribution in old format
      }));
    }

    const { data: insertedSalesItems, error: itemError } = await supabase
      .from("sales_items")
      .insert(salesItems)
      .select("id, lot_id");

    if (itemError) {
      logger.error("Failed to create sales items", itemError, undefined, {
        salesOrderId: salesOrder.id,
        itemsCount: salesItems.length,
      });
      return createErrorResponse(
        "Failed to create sales items",
        500,
        "SALES_ITEMS_CREATE_FAILED",
        itemError
      );
    }

    // Create purchase allocations if provided
    if (purchaseAllocationsMap.size > 0 && insertedSalesItems) {
      const allocationsToInsert: Array<{ sales_item_id: string; acquisition_id: string; qty: number }> = [];
      
      for (const salesItem of insertedSalesItems) {
        const allocations = purchaseAllocationsMap.get(salesItem.lot_id);
        if (allocations && allocations.length > 0) {
          for (const alloc of allocations) {
            allocationsToInsert.push({
              sales_item_id: salesItem.id,
              acquisition_id: alloc.purchaseId,
              qty: alloc.qty,
            });
          }
        }
      }
      
      if (allocationsToInsert.length > 0) {
        const { error: allocError } = await supabase
          .from("sales_item_purchase_allocations")
          .insert(allocationsToInsert);
        
        if (allocError) {
          logger.warn("Failed to create purchase allocations", allocError, undefined, {
            salesOrderId: salesOrder.id,
            allocationsCount: allocationsToInsert.length,
          });
          // Don't fail the sale if allocations fail, but log it
        }
      }
    }

    // Create sales consumables if provided
    if (validatedConsumables && validatedConsumables.length > 0) {
      const salesConsumables = validatedConsumables.map((c: any) => ({
        sales_order_id: salesOrder.id,
        consumable_id: c.consumable_id,
        qty: c.qty,
      }));

      if (salesConsumables.length > 0) {
        const { error: consumablesError } = await supabase
          .from("sales_consumables")
          .insert(salesConsumables);

        if (consumablesError) {
          logger.warn("Failed to create sales consumables", consumablesError, undefined, {
            salesOrderId: salesOrder.id,
            consumablesCount: salesConsumables.length,
          });
          // Don't fail the whole request, just log the error
        }
      }
    }

    // Check if lots should be marked as sold (quantity reaches 0)
    // Note: The trigger should handle this automatically, but we'll do it here for safety
    for (const lotToSell of lotsToSell) {
      const lot = lotsData.find((l: any) => l.id === lotToSell.lotId);
      if (!lot) continue;

      const currentSoldQty = soldQtyMap.get(lotToSell.lotId) || 0;
      const newSoldQty = currentSoldQty + lotToSell.qty;
      
      if (newSoldQty >= lot.quantity) {
        const { error: statusError } = await supabase
          .from("inventory_lots")
          .update({ status: "sold" })
          .eq("id", lotToSell.lotId);

        if (statusError) {
          logger.warn("Failed to update lot status", statusError, undefined, {
            lotId: lotToSell.lotId,
            salesOrderId: salesOrder.id,
          });
          // Don't fail the request, just log the error
        }
      }
    }

    // Log audit entry for sale creation
    try {
      await logAudit({
        user_id: userInfo?.userId || null,
        user_email: userInfo?.userEmail || null,
        action_type: "create_sale",
        entity_type: "sales_order",
        entity_id: salesOrder.id,
        old_values: null, // No old state for creation
        new_values: {
          platform: "ebay",
          buyer_id: buyerId,
          buyer_handle: validatedBuyerHandle,
          lots: lotsToSell.map((lot) => ({
            lot_id: lot.lotId,
            qty: lot.qty,
          })),
          fees_pence: validatedFeesPence,
          shipping_pence: validatedShippingPence,
          discount_pence: validatedDiscountPence,
        },
        description: `Sale recorded for ${validatedBuyerHandle} (${lotsToSell.length} item${lotsToSell.length > 1 ? "s" : ""})`,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      // Don't fail the sale if audit logging fails
      logger.warn("Failed to log audit entry for sale creation", auditError, undefined, {
        salesOrderId: salesOrder.id,
      });
    }

    // Log audit entries for each lot that was sold
    try {
      for (const lotToSell of lotsToSell) {
        const lot = lotsData.find((l: any) => l.id === lotToSell.lotId);
        if (lot) {
          const oldSoldQty = soldQtyMap.get(lotToSell.lotId) || 0;
          const newSoldQty = oldSoldQty + lotToSell.qty;
          
          await logAudit({
            user_id: userInfo?.userId || null,
            user_email: userInfo?.userEmail || null,
            action_type: "create_sale",
            entity_type: "inventory_lot",
            entity_id: lotToSell.lotId,
            old_values: {
              sold_quantity: oldSoldQty,
              status: lot.status,
            },
            new_values: {
              sold_quantity: newSoldQty,
              status: newSoldQty >= lot.quantity ? "sold" : lot.status,
            },
            description: `Sold ${lotToSell.qty} item${lotToSell.qty > 1 ? "s" : ""}`,
            ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
            user_agent: req.headers.get("user-agent") || null,
          });
        }
      }
    } catch (auditError) {
      // Don't fail the sale if audit logging fails
      logger.warn("Failed to log audit entries for lots", auditError, undefined, {
        salesOrderId: salesOrder.id,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Sale created successfully",
      salesOrderId: salesOrder.id,
    });
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "create_sale",
      metadata: { body },
    });
  }
}

