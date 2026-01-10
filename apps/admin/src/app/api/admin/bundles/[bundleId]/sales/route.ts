import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid } from "@/lib/validation";

// GET: Get sales information for a bundle (all sales orders for this bundle)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { bundleId } = await params;
    const validatedBundleId = uuid(bundleId, "bundleId");

    const supabase = supabaseServer();

    // Get all sales orders for this bundle
    const { data: salesOrders, error: salesError } = await supabase
      .from("sales_orders")
      .select(`
        id,
        sold_at,
        platform_order_ref,
        fees_pence,
        shipping_pence,
        discount_pence,
        order_group,
        buyers (
          id,
          handle,
          platform
        ),
        sales_items (
          id,
          qty,
          sold_price_pence,
          inventory_lots (
            id,
            cards (
              id,
              number,
              name,
              api_image_url,
              sets (
                id,
                name
              )
            ),
            condition,
            variation
          )
        ),
        sales_consumables (
          id,
          qty,
          consumables (
            id,
            name,
            unit
          )
        )
      `)
      .eq("bundle_id", validatedBundleId)
      .order("sold_at", { ascending: false });

    if (salesError) {
      logger.error("Failed to fetch bundle sales", salesError, undefined, { bundleId: validatedBundleId });
      return createErrorResponse(
        salesError.message || "Failed to fetch bundle sales",
        500,
        "FETCH_BUNDLE_SALES_FAILED",
        salesError
      );
    }

    // Get bundle details
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select(`
        id,
        name,
        description,
        price_pence,
        quantity,
        status,
        created_at,
        bundle_items (
          id,
          quantity,
          inventory_lots (
            id,
            cards (
              id,
              number,
              name,
              api_image_url,
              sets (
                id,
                name
              )
            ),
            condition,
            variation
          )
        )
      `)
      .eq("id", validatedBundleId)
      .single();

    if (bundleError) {
      logger.error("Failed to fetch bundle", bundleError, undefined, { bundleId: validatedBundleId });
      return createErrorResponse(
        bundleError.message || "Failed to fetch bundle",
        500,
        "FETCH_BUNDLE_FAILED",
        bundleError
      );
    }

    // Get consumable costs for all sales orders
    const salesOrderIds = (salesOrders || []).map((so: any) => so.id);
    const consumableCostsMap = new Map<string, number>();
    
    if (salesOrderIds.length > 0) {
      // Get all consumables used in these sales orders
      const { data: salesConsumables } = await supabase
        .from("sales_consumables")
        .select("consumable_id")
        .in("sales_order_id", salesOrderIds);

      const consumableIds = [
        ...new Set((salesConsumables || []).map((sc: any) => sc.consumable_id)),
      ];

      if (consumableIds.length > 0) {
        // Get costs from the view
        const { data: consumableCosts } = await supabase
          .from("v_consumable_costs")
          .select("consumable_id, avg_cost_pence_per_unit")
          .in("consumable_id", consumableIds);

        (consumableCosts || []).forEach((cost: any) => {
          consumableCostsMap.set(cost.consumable_id, cost.avg_cost_pence_per_unit || 0);
        });
      }
    }

    // Enhance sales orders with consumable costs
    const enrichedSales = (salesOrders || []).map((order: any) => ({
      ...order,
      sales_consumables: (order.sales_consumables || []).map((sc: any) => ({
        ...sc,
        consumables: sc.consumables
          ? {
              ...sc.consumables,
              avg_cost_pence_per_unit: consumableCostsMap.get(sc.consumables.id) || 0,
            }
          : null,
      })),
    }));

    return NextResponse.json({
      ok: true,
      bundle,
      sales: enrichedSales,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "get_bundle_sales",
    });
  }
}

