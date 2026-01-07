import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ acquisitionId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { acquisitionId } = await params;
    const supabase = supabaseServer();

    // Fetch the purchase info
    const { data: acquisition, error: acqError } = await supabase
      .from("acquisitions")
      .select("*")
      .eq("id", acquisitionId)
      .single();

    if (acqError || !acquisition) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Fetch purchase history to find all lots that have cards from this purchase
    // This includes merged lots that may no longer have acquisition_id set
    const { data: purchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, quantity")
      .eq("acquisition_id", acquisitionId);

    if (historyError) {
      logger.error("Failed to fetch purchase history", historyError, undefined, { acquisitionId });
      return createErrorResponse(
        "Failed to fetch purchase history",
        500,
        "FETCH_PURCHASE_HISTORY_FAILED",
        historyError
      );
    }

    // Get all lot IDs from purchase history (these are the lots that have cards from this purchase)
    const historyLotIds = (purchaseHistory || []).map((ph: any) => ph.lot_id);
    
    // Also get lots that directly have this acquisition_id (for backwards compatibility)
    const { data: directLots, error: directLotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity, acquisition_id")
      .eq("acquisition_id", acquisitionId);

    if (directLotsError) {
      logger.warn("Failed to fetch direct lots (legacy)", directLotsError, undefined, { acquisitionId });
    }

    const directLotIds = (directLots || []).map((l: any) => l.id);
    
    // Combine both sets of lot IDs
    const allLotIds = [...new Set([...historyLotIds, ...directLotIds])];

    // Create a map of lot_id -> original quantity from this purchase
    const purchaseQuantityMap = new Map<string, number>();
    (purchaseHistory || []).forEach((ph: any) => {
      purchaseQuantityMap.set(ph.lot_id, ph.quantity);
    });
    // For lots that don't have purchase history but have acquisition_id, use their current quantity
    (directLots || []).forEach((lot: any) => {
      if (!purchaseQuantityMap.has(lot.id)) {
        purchaseQuantityMap.set(lot.id, lot.quantity);
      }
    });

    // Get current quantities for ALL lots (needed for proportion calculation, especially for merged lots)
    const { data: allLots, error: allLotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity")
      .in("id", allLotIds);

    const currentLotQuantityMap = new Map<string, number>();
    (allLots || []).forEach((lot: any) => {
      currentLotQuantityMap.set(lot.id, lot.quantity);
    });

    // Calculate total cards from this purchase
    const cards_total = Array.from(purchaseQuantityMap.values()).reduce(
      (sum, qty) => sum + qty,
      0
    );

    if (allLotIds.length === 0 || cards_total === 0) {
      return NextResponse.json({
        ok: true,
        profit: {
          purchase_cost_pence: acquisition.purchase_total_pence,
          revenue_pence: 0,
          revenue_after_discount_pence: 0,
          consumables_cost_pence: 0,
          total_costs_pence: acquisition.purchase_total_pence,
          net_profit_pence: -acquisition.purchase_total_pence,
          margin_percent: 0,
          roi_percent: 0,
          cards_sold: 0,
          cards_total: 0,
        },
      });
    }

    // First, get purchase allocations for this purchase to find which sales items belong to it
    // This is especially important for bundle sales where we need to know exactly which items came from this purchase
    const { data: purchaseAllocations, error: allocError } = await supabase
      .from("sales_item_purchase_allocations")
      .select("sales_item_id, acquisition_id, qty")
      .eq("acquisition_id", acquisitionId);

    if (allocError) {
      logger.warn("Failed to fetch purchase allocations", allocError, undefined, { acquisitionId });
    }

    // Create a map of sales_item_id -> qty from this purchase
    const purchaseAllocationsMap = new Map<string, number>();
    const salesItemIdsWithAllocations = new Set<string>();
    (purchaseAllocations || []).forEach((alloc: any) => {
      purchaseAllocationsMap.set(alloc.sales_item_id, alloc.qty);
      salesItemIdsWithAllocations.add(alloc.sales_item_id);
    });
    
    console.log(`Purchase ${acquisitionId}: Found ${purchaseAllocations?.length || 0} purchase allocations:`, 
      Array.from(purchaseAllocationsMap.entries()).map(([id, qty]) => ({ sales_item_id: id, qty }))
    );

    // Now get the sales items that have allocations for this purchase
    // For bundle sales, we only want items where this purchase contributed
    const salesItemIdsArray = Array.from(salesItemIdsWithAllocations);
    
    let salesItems: any[] = [];
    if (salesItemIdsArray.length > 0) {
      const { data: salesItemsData, error: salesError } = await supabase
        .from("sales_items")
        .select(`
          id,
          lot_id,
          qty,
          sold_price_pence,
          sales_order_id
        `)
        .in("id", salesItemIdsArray);

      if (salesError) {
        logger.warn("Failed to fetch sales items", salesError, undefined, { acquisitionId });
        return NextResponse.json(
          { error: salesError.message || "Failed to fetch sales" },
          { status: 500 }
        );
      }
      salesItems = salesItemsData || [];
    }

    // For backwards compatibility with sales that don't have allocations,
    // also get sales items from lots that came from this purchase
    // These are non-bundle sales that don't have explicit allocations
    const { data: legacySalesItems, error: legacySalesError } = await supabase
      .from("sales_items")
      .select(`
        id,
        lot_id,
        qty,
        sold_price_pence,
        sales_order_id
      `)
      .in("lot_id", allLotIds);

    if (legacySalesError) {
      logger.warn("Failed to fetch legacy sales items", legacySalesError, undefined, { acquisitionId });
    }

    // Combine both sets, but exclude items that already have allocations to avoid duplicates
    // Items with allocations are from bundle sales and should use allocation data
    // Items without allocations are from regular sales and should use lot-based calculation
    const salesItemIdsWithAllocationsSet = new Set(salesItemIdsArray);
    const legacyItems = (legacySalesItems || []).filter(
      (item: any) => !salesItemIdsWithAllocationsSet.has(item.id)
    );

    // Combine: items with allocations (bundle sales) + items without allocations (regular sales)
    salesItems = [...salesItems, ...legacyItems];

    console.log(`Purchase ${acquisitionId}: Found ${purchaseAllocations?.length || 0} purchase allocations for ${salesItemIdsArray.length} sales items, ${legacyItems.length} legacy items, total ${salesItems.length} sales items`);

    // Get unique sales_order_ids
    const salesOrderIds = [
      ...new Set(
        (salesItems || [])
          .map((item: any) => item.sales_order_id)
          .filter(Boolean)
      ),
    ];

    // Get sales orders to check which are bundles
    const { data: salesOrders, error: ordersError } = await supabase
      .from("sales_orders")
      .select("id, bundle_id")
      .in("id", salesOrderIds);

    const bundleOrderIds = new Set<string>();
    (salesOrders || []).forEach((so: any) => {
      if (so.bundle_id) {
        bundleOrderIds.add(so.id);
      }
    });

    // For bundle sales, fetch all sales items upfront to get true total quantities
    // This avoids async issues in the loop and is more efficient
    const bundleOrderIdsArray = Array.from(bundleOrderIds);
    
    const allBundleSalesItemsMap = new Map<string, any[]>();
    if (bundleOrderIdsArray.length > 0) {
      const { data: allBundleSalesItems, error: bundleItemsError } = await supabase
        .from("sales_items")
        .select("id, qty, sales_order_id")
        .in("sales_order_id", bundleOrderIdsArray);

      if (!bundleItemsError && allBundleSalesItems) {
        // Group by sales_order_id
        allBundleSalesItems.forEach((item: any) => {
          const orderId = item.sales_order_id;
          if (!allBundleSalesItemsMap.has(orderId)) {
            allBundleSalesItemsMap.set(orderId, []);
          }
          allBundleSalesItemsMap.get(orderId)!.push(item);
        });
      }
    }

    // Get revenue and consumables from v_sales_order_profit view (includes discounts)
    // We need to proportionally allocate revenue based on which cards from this purchase were sold
    let revenue_pence = 0;
    let consumables_cost_pence = 0;
    
    if (salesOrderIds.length > 0) {
      const { data: profitData, error: profitError } = await supabase
        .from("v_sales_order_profit")
        .select("sales_order_id, revenue_after_discount_pence, consumables_cost_pence")
        .in("sales_order_id", salesOrderIds);

      if (profitError) {
        logger.error("Failed to fetch profit data", profitError, undefined, {
          acquisitionId,
          salesOrderIdsCount: salesOrderIds.length,
        });
        return createErrorResponse(
          profitError.message || "Failed to fetch profit data",
          500,
          "FETCH_PROFIT_DATA_FAILED",
          profitError
        );
      }

      // Create a map of sales_order_id -> profit data
      const profitDataMap = new Map();
      (profitData || []).forEach((p: any) => {
        profitDataMap.set(p.sales_order_id, p);
      });

      // Calculate proportional revenue for this purchase
      // For each sales order, calculate what portion of revenue belongs to this purchase
      for (const orderId of salesOrderIds) {
        const orderProfit = profitDataMap.get(orderId);
        if (!orderProfit) continue;

        // Get all sales items for this order that belong to this purchase
        const orderItems = (salesItems || []).filter(
          (si: any) => si.sales_order_id === orderId
        );

        // Check if this is a bundle sale
        const isBundleSale = bundleOrderIds.has(orderId);

        // For bundle sales, we need to get ALL sales items in the order to calculate total quantity
        // not just the ones from this purchase
        let allOrderItems = orderItems;
        if (isBundleSale) {
          // Use the pre-fetched bundle sales items
          const bundleItems = allBundleSalesItemsMap.get(orderId) || [];
          if (bundleItems.length > 0) {
            allOrderItems = bundleItems;
          }
        }

        // Calculate total quantity in order (all items, not just from this purchase)
        const totalQtyInOrder = allOrderItems.reduce((sum, item: any) => sum + item.qty, 0);

        // Calculate quantity from this purchase
        let totalQtyFromPurchase = 0;
        orderItems.forEach((item: any) => {
          // Check if we have purchase allocation data for this specific purchase
          const qtyFromPurchase = purchaseAllocationsMap.get(item.id);
          if (qtyFromPurchase !== undefined && qtyFromPurchase > 0) {
            // We have exact allocation data for this purchase (bundle sales)
            totalQtyFromPurchase += qtyFromPurchase;
          } else if (!isBundleSale) {
            // For non-bundle sales, use fallback logic based on lot's purchase history
            const originalQtyFromPurchase = purchaseQuantityMap.get(item.lot_id) || 0;
            const currentLotQty = currentLotQuantityMap.get(item.lot_id) || 0;
            const lot = directLots?.find((l: any) => l.id === item.lot_id);
            
            // ALWAYS check purchase history first - this is the source of truth for merged lots
            if (originalQtyFromPurchase > 0) {
              // Lot has purchase history (may be merged) - calculate proportion
              if (currentLotQty > 0) {
                // Calculate proportion: how much of this lot came from this purchase
                const proportion = originalQtyFromPurchase / currentLotQty;
                totalQtyFromPurchase += item.qty * proportion;
              } else {
                // Current quantity is 0 (all sold) - if this is the only purchase source, use full quantity
                // Otherwise, we can't accurately calculate, so skip
                // For safety, if originalQtyFromPurchase equals what was sold, assume it's all from this purchase
                totalQtyFromPurchase += item.qty;
              }
            } else if (lot && lot.acquisition_id === acquisitionId) {
              // No purchase history but lot is directly from this purchase (not merged) - use full quantity
              totalQtyFromPurchase += item.qty;
            }
            // If no purchase history and not a direct lot, skip (don't add anything)
          }
          // For bundle sales without allocations, we skip (don't add anything)
        });

        // For bundle sales, we MUST have allocation data to split revenue correctly
        if (isBundleSale && totalQtyFromPurchase === 0) {
          // This is a bundle sale but we have no allocations for this purchase
          // This means this purchase didn't contribute to this bundle - skip it
          console.warn(`Bundle sale ${orderId} has no purchase allocations for purchase ${acquisitionId} - skipping revenue allocation`);
          continue; // Skip this order for this purchase
        }

        // Calculate revenue proportionally based on quantity allocation
        // Use the order's total revenue from the view (which includes bundle price for bundles)
        const orderRevenueAfterDiscount = orderProfit.revenue_after_discount_pence || 0;
        
        // Calculate what proportion of the total order this purchase represents
        const purchaseProportion = totalQtyInOrder > 0 
          ? totalQtyFromPurchase / totalQtyInOrder 
          : 0;
        
        // Allocate the revenue proportionally based on card count
        const purchaseRevenue = orderRevenueAfterDiscount * purchaseProportion;
        
        console.log(`Purchase ${acquisitionId}, Order ${orderId} (bundle: ${isBundleSale}): ${totalQtyFromPurchase}/${totalQtyInOrder} cards, proportion: ${purchaseProportion.toFixed(3)}, revenue: £${(purchaseRevenue / 100).toFixed(2)}`);

        revenue_pence += Math.max(0, purchaseRevenue);

        // Allocate consumables proportionally based on card count
        if (totalQtyInOrder > 0) {
          const consumablesProportion = totalQtyFromPurchase / totalQtyInOrder;
          consumables_cost_pence += 
            (orderProfit.consumables_cost_pence || 0) * consumablesProportion;
        }
      }
    }


    // Calculate profit/loss
    const purchase_cost_pence = acquisition.purchase_total_pence;
    const total_costs_pence = purchase_cost_pence + consumables_cost_pence;
    const net_profit_pence = revenue_pence - total_costs_pence;
    
    // Net margin: (Net Profit / Revenue After Discount) * 100
    const margin_percent =
      revenue_pence > 0
        ? (net_profit_pence / revenue_pence) * 100
        : 0;
    
    // ROI (Return on Investment): (Net Profit / Purchase Cost) * 100
    const roi_percent =
      purchase_cost_pence > 0
        ? (net_profit_pence / purchase_cost_pence) * 100
        : 0;

    // Count cards sold from this purchase
    let cards_sold = 0;
    (salesItems || []).forEach((item: any) => {
      // Check if we have purchase allocation data
      const qtyFromPurchase = purchaseAllocationsMap.get(item.id);
      if (qtyFromPurchase !== undefined) {
        cards_sold += qtyFromPurchase;
      } else {
        // No allocation data - use proportional calculation (same logic as revenue calculation)
        const originalQtyFromPurchase = purchaseQuantityMap.get(item.lot_id) || 0;
        const currentLotQty = currentLotQuantityMap.get(item.lot_id) || 0;
        const lot = directLots?.find((l: any) => l.id === item.lot_id);
        
        // ALWAYS check purchase history first - this is the source of truth for merged lots
        if (originalQtyFromPurchase > 0) {
          // Lot has purchase history (may be merged) - calculate proportion
          if (currentLotQty > 0) {
            // Current quantity > 0: calculate proportion based on current lot quantity
            const proportion = originalQtyFromPurchase / currentLotQty;
            cards_sold += Math.floor(item.qty * proportion);
          } else {
            // Current quantity is 0 (all sold) - calculate proportion using total original quantity
            // When currentLotQty = 0, total original = current (0) + sold (item.qty) = item.qty
            // Use item.qty as the total original quantity for proportion calculation
            const totalOriginalQty = item.qty;
            if (totalOriginalQty > 0) {
              const proportion = originalQtyFromPurchase / totalOriginalQty;
              cards_sold += Math.floor(item.qty * proportion);
            } else {
              // Fallback: if we can't calculate, use full quantity
              cards_sold += item.qty;
            }
          }
        } else if (lot && lot.acquisition_id === acquisitionId) {
          // No purchase history but lot is directly from this purchase (not merged) - use full quantity
          cards_sold += item.qty;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      profit: {
        purchase_cost_pence,
        revenue_pence,
        revenue_after_discount_pence: revenue_pence, // This is already the discounted revenue from the view
        consumables_cost_pence,
        total_costs_pence,
        net_profit_pence,
        margin_percent,
        roi_percent,
        cards_sold,
        cards_total,
      },
    });
  } catch (error: any) {
    return handleApiError(req, error, {
      operation: "fetch_purchase_profit",
      metadata: { acquisitionId },
    });
  }
}

