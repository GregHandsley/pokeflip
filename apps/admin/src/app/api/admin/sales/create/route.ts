import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      lotId, // Legacy support - single lot
      lots, // New format - array of { lotId, qty }
      qty, // Legacy support
      soldPricePence,
      buyerHandle,
      orderGroup,
      feesPence,
      shippingPence,
      consumables, // Array of { consumable_id, qty }
    } = body;

    // Support both old format (lotId + qty) and new format (lots array)
    let lotsToSell: Array<{ lotId: string; qty: number }> = [];
    
    if (lots && Array.isArray(lots)) {
      // New format: array of lots
      lotsToSell = lots.map((l: any) => ({
        lotId: l.lotId,
        qty: l.qty,
      }));
    } else if (lotId && qty) {
      // Legacy format: single lot
      lotsToSell = [{ lotId, qty }];
    } else {
      return NextResponse.json(
        { error: "Missing required fields: either (lotId + qty) or (lots array)" },
        { status: 400 }
      );
    }

    if (!soldPricePence || !buyerHandle) {
      return NextResponse.json(
        { error: "Missing required fields: soldPricePence, buyerHandle" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verify all lots exist and have enough available quantity
    const lotIds = lotsToSell.map((l) => l.lotId);
    const { data: lotsData, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, status")
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
      const availableQty = lot.quantity - currentSoldQty;

      if (lotToSell.qty > availableQty) {
        return NextResponse.json(
          { error: `Only ${availableQty} items available for lot ${lotToSell.lotId}` },
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

    // Create sales order
    // Build insert object - only include fields that exist in the schema
    // Since migration may not be run, we'll try with optional fields first,
    // then fall back to required fields only if there's a column error
    const orderData: any = {
      platform: "ebay",
      buyer_id: buyerId,
    };
    
    // Only add optional fields if they have values (we'll handle column errors separately)
    if (orderGroup && orderGroup.trim()) {
      orderData.order_group = orderGroup.trim();
    }
    if (feesPence != null && feesPence > 0) {
      orderData.fees_pence = feesPence;
    }
    if (shippingPence != null && shippingPence > 0) {
      orderData.shipping_pence = shippingPence;
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
        console.warn("Optional columns not found, creating order without them:", {
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
      console.error("Error creating sales order:", orderError);
      return NextResponse.json(
        { error: orderError?.message || "Failed to create sales order" },
        { status: 500 }
      );
    }

    // Calculate total quantity across all lots
    const totalQty = lotsToSell.reduce((sum, lot) => sum + lot.qty, 0);
    
    // soldPricePence is the total price for all items, so we need to calculate price per unit
    const pricePerUnitPence = Math.round(soldPricePence / totalQty);
    
    // Create sales items for all lots
    const salesItems = lotsToSell.map((lotToSell) => ({
      sales_order_id: salesOrder.id,
      lot_id: lotToSell.lotId,
      qty: lotToSell.qty,
      sold_price_pence: pricePerUnitPence, // Store price per unit, not total
    }));

    const { error: itemError } = await supabase
      .from("sales_items")
      .insert(salesItems);

    if (itemError) {
      console.error("Error creating sales items:", itemError);
      return NextResponse.json(
        { error: "Failed to create sales items" },
        { status: 500 }
      );
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
          console.error("Error creating sales consumables:", consumablesError);
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
          console.error("Error updating lot status:", statusError);
          // Don't fail the request, just log the error
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Sale created successfully",
      salesOrderId: salesOrder.id,
    });
  } catch (error: any) {
    console.error("Error in create sale API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

