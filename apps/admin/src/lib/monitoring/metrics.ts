/**
 * Metrics tracking service
 * Tracks key business metrics: sales volume, inventory levels, etc.
 */

import { supabaseServer } from "@/lib/supabase/server";
import { createApiLogger } from "../logger";
import { trackMetric } from "./alerts";

export interface SalesMetrics {
  totalSalesCount: number;
  totalRevenuePence: number;
  recentSalesCount: number; // Last 7 days
  recentRevenuePence: number; // Last 7 days
  averageOrderValuePence: number;
  timestamp: string;
}

export interface InventoryMetrics {
  totalLots: number;
  activeLots: number; // draft, ready, listed
  listedLots: number;
  soldLots: number;
  totalQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  timestamp: string;
}

export interface BusinessMetrics {
  sales: SalesMetrics;
  inventory: InventoryMetrics;
  timestamp: string;
}

/**
 * Fetch and calculate sales metrics
 */
export async function getSalesMetrics(days: number = 7): Promise<SalesMetrics> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    // Get all sales orders with profit data
    // Use revenue_after_discount_pence if available, fallback to revenue_pence
    const { data: allSales, error: allSalesError } = await supabase
      .from("v_sales_order_profit")
      .select("sales_order_id, revenue_pence, revenue_after_discount_pence, sold_at");

    if (allSalesError) {
      logger.error("Failed to fetch sales metrics", allSalesError, undefined, {
        operation: "get_sales_metrics",
      });
      throw allSalesError;
    }

    const totalSalesCount = allSales?.length || 0;
    
    // Calculate total revenue: use revenue_after_discount_pence if available (accounts for discounts),
    // otherwise fall back to revenue_pence (base revenue before discounts).
    // This ensures accurate revenue tracking when discounts are applied.
    const totalRevenuePence = (allSales || []).reduce(
      (sum, sale) => {
        // Priority: discount-adjusted revenue > base revenue > 0
        const revenue = (sale as any).revenue_after_discount_pence ?? (sale as any).revenue_pence ?? 0;
        return sum + revenue;
      },
      0
    );

    // Calculate recent sales: filter sales from the last N days.
    // Uses cutoff date to determine which sales count as "recent" for trend analysis.
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const recentSales = (allSales || []).filter(
      (sale) => new Date(sale.sold_at) >= cutoffDate
    );

    const recentSalesCount = recentSales.length;
    const recentRevenuePence = recentSales.reduce(
      (sum, sale) => {
        const revenue = (sale as any).revenue_after_discount_pence ?? (sale as any).revenue_pence ?? 0;
        return sum + revenue;
      },
      0
    );

    const averageOrderValuePence =
      totalSalesCount > 0 ? Math.round(totalRevenuePence / totalSalesCount) : 0;

    const metrics: SalesMetrics = {
      totalSalesCount,
      totalRevenuePence,
      recentSalesCount,
      recentRevenuePence,
      averageOrderValuePence,
      timestamp: new Date().toISOString(),
    };

    // Track metrics and alert on anomalies (wrapped in try/catch to avoid breaking the flow)
    try {
      trackMetric("sales.total_count", totalSalesCount, undefined, {
        operation: "get_sales_metrics",
      });
      trackMetric("sales.total_revenue_pence", totalRevenuePence, undefined, {
        operation: "get_sales_metrics",
      });
      trackMetric("sales.recent_count", recentSalesCount, {
        criticalMin: 0, // Alert if no sales in recent period
      }, {
        operation: "get_sales_metrics",
      });
    } catch (trackError) {
      // Ignore tracking errors - don't break the metrics response
      logger.debug("Error tracking sales metrics", undefined, {
        operation: "get_sales_metrics",
        error: trackError,
      });
    }

    return metrics;
  } catch (error) {
    logger.error("Error calculating sales metrics", error, undefined, {
      operation: "get_sales_metrics",
    });
    throw error;
  }
}

/**
 * Fetch and calculate inventory metrics
 */
export async function getInventoryMetrics(): Promise<InventoryMetrics> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    // Get all inventory lots with status and quantity
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select("id, status, quantity, for_sale");

    if (lotsError) {
      logger.error("Failed to fetch inventory metrics", lotsError, undefined, {
        operation: "get_inventory_metrics",
      });
      throw lotsError;
    }

    const allLots = lots || [];
    const totalLots = allLots.length;
    
    // Count lots by status
    const activeLots = allLots.filter((lot) =>
      ["draft", "ready", "listed"].includes(lot.status)
    ).length;
    
    const listedLots = allLots.filter((lot) => lot.status === "listed").length;
    const soldLots = allLots.filter((lot) => lot.status === "sold").length;

    // Calculate quantities
    const totalQuantity = allLots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
    
    // Available quantity (active lots that haven't been sold)
    const availableQuantity = allLots
      .filter((lot) => ["draft", "ready", "listed"].includes(lot.status))
      .reduce((sum, lot) => sum + (lot.quantity || 0), 0);

    // Get sold quantities from sales_items to calculate actual available inventory.
    // A lot may have been partially sold (e.g., 10 cards in lot, 3 sold),
    // so we need to track sold quantities separately to get accurate available counts.
    const { data: soldItems, error: soldItemsError } = await supabase
      .from("sales_items")
      .select("qty, lot_id");

    if (soldItemsError) {
      logger.error("Failed to fetch sold items for metrics", soldItemsError, undefined, {
        operation: "get_inventory_metrics",
      });
      // Don't throw - continue without sold quantity tracking to avoid breaking the metrics endpoint
      // The available quantity will be slightly inaccurate but the endpoint still works
    }

    // Build a map of lot_id -> total sold quantity.
    // Multiple sales_items can reference the same lot_id, so we sum them up.
    const soldQuantityMap = new Map<string, number>();
    (soldItems || []).forEach((item: any) => {
      const lotId = item.lot_id;
      if (lotId) {
        const current = soldQuantityMap.get(lotId) || 0;
        soldQuantityMap.set(lotId, current + (item.qty || 0));
      }
    });

    // Recalculate available quantity accounting for partial sales.
    // For active lots (draft, ready, listed), subtract sold quantity from total quantity.
    // Use Math.max to ensure we never have negative available quantities.
    let actualAvailableQuantity = 0;
    allLots
      .filter((lot) => ["draft", "ready", "listed"].includes(lot.status))
      .forEach((lot) => {
        const soldQty = soldQuantityMap.get(lot.id) || 0;
        actualAvailableQuantity += Math.max(0, (lot.quantity || 0) - soldQty);
      });

    // Low stock threshold (adjust based on your business needs)
    const lowStockThreshold = 50; // Alert if available quantity drops below this

    const metrics: InventoryMetrics = {
      totalLots,
      activeLots,
      listedLots,
      soldLots,
      totalQuantity,
      availableQuantity: actualAvailableQuantity,
      lowStockThreshold,
      timestamp: new Date().toISOString(),
    };

    // Track metrics and alert on low stock (wrapped in try/catch to avoid breaking the flow)
    try {
      trackMetric("inventory.total_lots", totalLots, undefined, {
        operation: "get_inventory_metrics",
      });
      trackMetric("inventory.active_lots", activeLots, undefined, {
        operation: "get_inventory_metrics",
      });
      trackMetric("inventory.available_quantity", actualAvailableQuantity, {
        criticalMin: lowStockThreshold,
        min: lowStockThreshold * 2,
      }, {
        operation: "get_inventory_metrics",
      });
      trackMetric("inventory.listed_lots", listedLots, undefined, {
        operation: "get_inventory_metrics",
      });
    } catch (trackError) {
      // Ignore tracking errors - don't break the metrics response
      logger.debug("Error tracking inventory metrics", undefined, {
        operation: "get_inventory_metrics",
        error: trackError,
      });
    }

    return metrics;
  } catch (error) {
    logger.error("Error calculating inventory metrics", error, undefined, {
      operation: "get_inventory_metrics",
    });
    throw error;
  }
}

/**
 * Get comprehensive business metrics
 */
export async function getBusinessMetrics(days: number = 7): Promise<BusinessMetrics> {
  try {
    const [sales, inventory] = await Promise.all([
      getSalesMetrics(days),
      getInventoryMetrics(),
    ]);

    return {
      sales,
      inventory,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const logger = createApiLogger(new Request("http://localhost"));
    logger.error("Error fetching business metrics", error, undefined, {
      operation: "get_business_metrics",
    });
    throw error;
  }
}

