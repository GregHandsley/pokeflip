import { supabaseServer } from "@/lib/supabase/server";
import { createApiLogger } from "@/lib/logger";

export interface IntegrityIssue {
  type: "orphaned_record" | "quantity_inconsistency" | "profit_calculation" | "other";
  severity: "error" | "warning";
  entity_type: string;
  entity_id: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface IntegrityCheckResult {
  check_name: string;
  status: "pass" | "fail" | "warning";
  issues: IntegrityIssue[];
  execution_time_ms: number;
}

export interface IntegrityReport {
  timestamp: string;
  overall_status: "healthy" | "degraded" | "unhealthy";
  checks: IntegrityCheckResult[];
  total_issues: number;
  execution_time_ms: number;
}

// Database row types
type IdRow = {
  id: string;
};

type SalesItemRow = {
  id: string;
  lot_id: string;
  qty?: number;
  sold_price_pence?: number;
  sales_order_id?: string;
};

type BundleItemRow = {
  id: string;
  bundle_id: string;
  lot_id: string;
  quantity?: number;
};

type PurchaseAllocationRow = {
  id: string;
  sales_item_id: string;
  acquisition_id: string;
};

type LotPhotoRow = {
  id: string;
  lot_id: string;
};

type EbayListingRow = {
  id: string;
  lot_id: string;
};

type InventoryLotRow = {
  id: string;
  quantity: number;
};

type SalesConsumableRow = {
  consumable_id: string;
  qty?: number;
};

type ConsumableCostRow = {
  consumable_id: string;
  avg_cost_pence_per_unit?: number;
};

/**
 * Check for orphaned records across all tables
 */
export async function checkOrphanedRecords(): Promise<IntegrityCheckResult> {
  const startTime = Date.now();
  const logger = createApiLogger(new Request("http://localhost"));
  const supabase = supabaseServer();
  const issues: IntegrityIssue[] = [];

  try {
    // Get all valid IDs first
    const { data: validLotIds } = await supabase.from("inventory_lots").select("id");
    const lotIdSet = new Set(((validLotIds || []) as IdRow[]).map((l) => l.id));

    const { data: validBundleIds } = await supabase.from("bundles").select("id");
    const bundleIdSet = new Set(((validBundleIds || []) as IdRow[]).map((b) => b.id));

    const { data: validSalesItemIds } = await supabase.from("sales_items").select("id");
    const salesItemIdSet = new Set(((validSalesItemIds || []) as IdRow[]).map((s) => s.id));

    const { data: validAcquisitionIds } = await supabase.from("acquisitions").select("id");
    const acquisitionIdSet = new Set(((validAcquisitionIds || []) as IdRow[]).map((a) => a.id));

    // Check sales_items with invalid lot_id
    const { data: allSalesItems } = await supabase.from("sales_items").select("id, lot_id");

    if (allSalesItems) {
      ((allSalesItems || []) as SalesItemRow[]).forEach((item) => {
        if (!lotIdSet.has(item.lot_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "error",
            entity_type: "sales_item",
            entity_id: item.id,
            message: `Sales item references non-existent lot`,
            details: { lot_id: item.lot_id },
          });
        }
      });
    }

    // Check bundle_items with invalid bundle_id
    const { data: allBundleItems } = await supabase
      .from("bundle_items")
      .select("id, bundle_id, lot_id");

    if (allBundleItems) {
      ((allBundleItems || []) as BundleItemRow[]).forEach((item) => {
        if (!bundleIdSet.has(item.bundle_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "error",
            entity_type: "bundle_item",
            entity_id: item.id,
            message: `Bundle item references non-existent bundle`,
            details: { bundle_id: item.bundle_id },
          });
        }
        if (!lotIdSet.has(item.lot_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "error",
            entity_type: "bundle_item",
            entity_id: item.id,
            message: `Bundle item references non-existent lot`,
            details: { lot_id: item.lot_id },
          });
        }
      });
    }

    // Check sales_item_purchase_allocations with invalid references
    const { data: allAllocations } = await supabase
      .from("sales_item_purchase_allocations")
      .select("id, sales_item_id, acquisition_id");

    if (allAllocations) {
      ((allAllocations || []) as PurchaseAllocationRow[]).forEach((item) => {
        if (!salesItemIdSet.has(item.sales_item_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "error",
            entity_type: "sales_item_purchase_allocation",
            entity_id: item.id,
            message: `Purchase allocation references non-existent sales item`,
            details: { sales_item_id: item.sales_item_id },
          });
        }
        if (!acquisitionIdSet.has(item.acquisition_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "error",
            entity_type: "sales_item_purchase_allocation",
            entity_id: item.id,
            message: `Purchase allocation references non-existent acquisition`,
            details: { acquisition_id: item.acquisition_id },
          });
        }
      });
    }

    // Check lot_photos with invalid lot_id
    const { data: allPhotos } = await supabase.from("lot_photos").select("id, lot_id");

    if (allPhotos) {
      ((allPhotos || []) as LotPhotoRow[]).forEach((item) => {
        if (!lotIdSet.has(item.lot_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "warning",
            entity_type: "lot_photo",
            entity_id: item.id,
            message: `Photo references non-existent lot`,
            details: { lot_id: item.lot_id },
          });
        }
      });
    }

    // Check eBay listings with invalid lot_id
    const { data: allListings } = await supabase.from("ebay_listings").select("id, lot_id");

    if (allListings) {
      ((allListings || []) as EbayListingRow[]).forEach((item) => {
        if (!lotIdSet.has(item.lot_id)) {
          issues.push({
            type: "orphaned_record",
            severity: "warning",
            entity_type: "ebay_listing",
            entity_id: item.id,
            message: `eBay listing references non-existent lot`,
            details: { lot_id: item.lot_id },
          });
        }
      });
    }

    const executionTime = Date.now() - startTime;
    return {
      check_name: "orphaned_records",
      status:
        issues.length === 0
          ? "pass"
          : issues.some((i) => i.severity === "error")
            ? "fail"
            : "warning",
      issues,
      execution_time_ms: executionTime,
    };
  } catch (error) {
    logger.error(
      "Error checking orphaned records",
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      {
        operation: "check_orphaned_records",
      }
    );

    const executionTime = Date.now() - startTime;
    return {
      check_name: "orphaned_records",
      status: "fail",
      issues: [
        {
          type: "other",
          severity: "error",
          entity_type: "system",
          entity_id: "unknown",
          message: `Error running orphaned records check: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      execution_time_ms: executionTime,
    };
  }
}

/**
 * Check quantity consistency (sold quantities vs lot quantities, bundle quantities, etc.)
 */
export async function checkQuantityConsistency(): Promise<IntegrityCheckResult> {
  const startTime = Date.now();
  const logger = createApiLogger(new Request("http://localhost"));
  const supabase = supabaseServer();
  const issues: IntegrityIssue[] = [];

  try {
    // Check if sold quantities exceed lot quantities
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, quantity");

    if (!lotsError && lots) {
      // Get all sold quantities in one query
      const { data: allSoldItems } = await supabase.from("sales_items").select("lot_id, qty");

      const soldQtyMap = new Map<string, number>();
      if (allSoldItems) {
        ((allSoldItems || []) as SalesItemRow[]).forEach((item) => {
          const current = soldQtyMap.get(item.lot_id) || 0;
          soldQtyMap.set(item.lot_id, current + (item.qty || 0));
        });
      }

      ((lots || []) as InventoryLotRow[]).forEach((lot) => {
        const totalSold = soldQtyMap.get(lot.id) || 0;
        if (totalSold > lot.quantity) {
          issues.push({
            type: "quantity_inconsistency",
            severity: "error",
            entity_type: "inventory_lot",
            entity_id: lot.id,
            message: `Sold quantity (${totalSold}) exceeds lot quantity (${lot.quantity}) by ${totalSold - lot.quantity}`,
            details: {
              lot_quantity: lot.quantity,
              sold_quantity: totalSold,
              excess: totalSold - lot.quantity,
            },
          });
        }
      });
    }

    // Check bundle item quantities match lot quantities
    const { data: bundles, error: bundlesError } = await supabase.from("bundles").select("id");

    if (!bundlesError && bundles) {
      for (const bundle of bundles) {
        const { data: bundleItems, error: bundleItemsError } = await supabase
          .from("bundle_items")
          .select("lot_id, quantity")
          .eq("bundle_id", bundle.id);

        if (!bundleItemsError && bundleItems) {
          for (const bundleItem of bundleItems) {
            const { data: lot, error: lotError } = await supabase
              .from("inventory_lots")
              .select("quantity")
              .eq("id", bundleItem.lot_id)
              .single();

            if (!lotError && lot) {
              if (bundleItem.quantity > lot.quantity) {
                issues.push({
                  type: "quantity_inconsistency",
                  severity: "warning",
                  entity_type: "bundle_item",
                  entity_id: bundleItem.lot_id,
                  message: `Bundle item quantity (${bundleItem.quantity}) exceeds available lot quantity (${lot.quantity})`,
                  details: {
                    bundle_id: bundle.id,
                    lot_id: bundleItem.lot_id,
                    bundle_quantity: bundleItem.quantity,
                    lot_quantity: lot.quantity,
                  },
                });
              }
            }
          }
        }
      }
    }

    const executionTime = Date.now() - startTime;
    return {
      check_name: "quantity_consistency",
      status:
        issues.length === 0
          ? "pass"
          : issues.some((i) => i.severity === "error")
            ? "fail"
            : "warning",
      issues,
      execution_time_ms: executionTime,
    };
  } catch (error) {
    logger.error(
      "Error checking quantity consistency",
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      {
        operation: "check_quantity_consistency",
      }
    );

    const executionTime = Date.now() - startTime;
    return {
      check_name: "quantity_consistency",
      status: "fail",
      issues: [
        {
          type: "other",
          severity: "error",
          entity_type: "system",
          entity_id: "unknown",
          message: `Error running quantity consistency check: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      execution_time_ms: executionTime,
    };
  }
}

/**
 * Validate profit calculations against the v_sales_order_profit view
 */
export async function validateProfitCalculations(): Promise<IntegrityCheckResult> {
  const startTime = Date.now();
  const logger = createApiLogger(new Request("http://localhost"));
  const supabase = supabaseServer();
  const issues: IntegrityIssue[] = [];

  try {
    // Get all sales orders with profit data
    const { data: salesOrders, error: ordersError } = await supabase
      .from("sales_orders")
      .select("id, fees_pence, shipping_pence, discount_pence");

    if (ordersError || !salesOrders) {
      const executionTime = Date.now() - startTime;
      return {
        check_name: "profit_calculations",
        status: "fail",
        issues: [
          {
            type: "profit_calculation",
            severity: "error",
            entity_type: "system",
            entity_id: "unknown",
            message: `Error fetching sales orders: ${ordersError?.message || "Unknown error"}`,
          },
        ],
        execution_time_ms: executionTime,
      };
    }

    // For each order, manually calculate profit and compare with view
    for (const order of salesOrders) {
      // Get revenue from sales_items
      const { data: salesItems, error: itemsError } = await supabase
        .from("sales_items")
        .select("sold_price_pence, qty")
        .eq("sales_order_id", order.id);

      if (itemsError) continue;

      const revenuePence = (salesItems || []).reduce(
        (sum, item) => sum + (item.sold_price_pence || 0) * (item.qty || 0),
        0
      );

      // Get consumables cost
      const { data: salesConsumables, error: consumablesError } = await supabase
        .from("sales_consumables")
        .select("consumable_id, qty")
        .eq("sales_order_id", order.id);

      let consumablesCostPence = 0;
      if (!consumablesError && salesConsumables && salesConsumables.length > 0) {
        // Get consumable costs from view
        const consumableIds = [
          ...new Set(
            ((salesConsumables || []) as SalesConsumableRow[]).map((c) => c.consumable_id)
          ),
        ];
        const { data: consumableCosts } = await supabase
          .from("v_consumable_costs")
          .select("consumable_id, avg_cost_pence_per_unit")
          .in("consumable_id", consumableIds);

        const costMap = new Map(
          ((consumableCosts || []) as ConsumableCostRow[]).map((c) => [
            c.consumable_id,
            c.avg_cost_pence_per_unit || 0,
          ])
        );

        consumablesCostPence = ((salesConsumables || []) as SalesConsumableRow[]).reduce(
          (sum: number, sc) => {
            const unitCost = costMap.get(sc.consumable_id) || 0;
            return sum + (sc.qty || 0) * unitCost;
          },
          0
        );
      }

      // Calculate expected values
      const discountPence = order.discount_pence || 0;
      const revenueAfterDiscountPence = revenuePence - discountPence;
      const feesPence = order.fees_pence || 0;
      const shippingPence = order.shipping_pence || 0;
      const totalCostsPence = feesPence + shippingPence + consumablesCostPence;
      const netProfitPence = revenueAfterDiscountPence - totalCostsPence;

      // Get actual values from view
      const { data: profitData, error: profitError } = await supabase
        .from("v_sales_order_profit")
        .select("*")
        .eq("sales_order_id", order.id)
        .single();

      if (profitError || !profitData) continue;

      // Compare (allow small rounding differences - 2 pence tolerance for floating point rounding)
      const tolerance = 2;
      const revenueDiff = Math.abs((profitData.revenue_pence || 0) - revenuePence);
      const revenueAfterDiscountDiff = Math.abs(
        (profitData.revenue_after_discount_pence || 0) - revenueAfterDiscountPence
      );
      const netProfitDiff = Math.abs((profitData.net_profit_pence || 0) - netProfitPence);

      if (revenueDiff > tolerance) {
        issues.push({
          type: "profit_calculation",
          severity: "error",
          entity_type: "sales_order",
          entity_id: order.id,
          message: `Revenue mismatch: expected ${revenuePence}, got ${profitData.revenue_pence}`,
          details: {
            expected: revenuePence,
            actual: profitData.revenue_pence,
            difference: revenueDiff,
          },
        });
      }

      if (revenueAfterDiscountDiff > tolerance) {
        issues.push({
          type: "profit_calculation",
          severity: "error",
          entity_type: "sales_order",
          entity_id: order.id,
          message: `Revenue after discount mismatch: expected ${revenueAfterDiscountPence}, got ${profitData.revenue_after_discount_pence}`,
          details: {
            expected: revenueAfterDiscountPence,
            actual: profitData.revenue_after_discount_pence,
            difference: revenueAfterDiscountDiff,
          },
        });
      }

      if (netProfitDiff > tolerance) {
        issues.push({
          type: "profit_calculation",
          severity: "error",
          entity_type: "sales_order",
          entity_id: order.id,
          message: `Net profit mismatch: expected ${netProfitPence}, got ${profitData.net_profit_pence}`,
          details: {
            expected: netProfitPence,
            actual: profitData.net_profit_pence,
            difference: netProfitDiff,
            expected_costs: totalCostsPence,
            actual_costs: profitData.total_costs_pence || 0,
          },
        });
      }
    }

    const executionTime = Date.now() - startTime;
    return {
      check_name: "profit_calculations",
      status: issues.length === 0 ? "pass" : "fail",
      issues,
      execution_time_ms: executionTime,
    };
  } catch (error) {
    logger.error(
      "Error validating profit calculations",
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      {
        operation: "validate_profit_calculations",
      }
    );

    const executionTime = Date.now() - startTime;
    return {
      check_name: "profit_calculations",
      status: "fail",
      issues: [
        {
          type: "other",
          severity: "error",
          entity_type: "system",
          entity_id: "unknown",
          message: `Error running profit validation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      execution_time_ms: executionTime,
    };
  }
}

/**
 * Run all integrity checks
 */
export async function runAllIntegrityChecks(): Promise<IntegrityReport> {
  const startTime = Date.now();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    const checks = await Promise.all([
      checkOrphanedRecords(),
      checkQuantityConsistency(),
      validateProfitCalculations(),
    ]);

    const totalIssues = checks.reduce((sum, check) => sum + check.issues.length, 0);
    const hasErrors = checks.some((check) => check.status === "fail");
    const hasWarnings = checks.some((check) => check.status === "warning");

    const overallStatus: IntegrityReport["overall_status"] = hasErrors
      ? "unhealthy"
      : hasWarnings
        ? "degraded"
        : "healthy";

    const executionTime = Date.now() - startTime;

    return {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      checks,
      total_issues: totalIssues,
      execution_time_ms: executionTime,
    };
  } catch (error) {
    logger.error(
      "Error running integrity checks",
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      {
        operation: "run_all_integrity_checks",
      }
    );

    const executionTime = Date.now() - startTime;
    return {
      timestamp: new Date().toISOString(),
      overall_status: "unhealthy",
      checks: [],
      total_issues: 1,
      execution_time_ms: executionTime,
    };
  }
}
