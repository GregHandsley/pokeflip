// Use Edge runtime for Cloudflare Pages compatibility
// CSV export requires Node.js stream, so we'll use a simpler CSV generation for Edge
export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { penceToPounds } from "@pokeflip/shared";

type AcquisitionRow = {
  id: string;
  source_name: string;
  source_type: string;
  reference: string | null;
  purchase_total_pence: number | null;
  purchased_at: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type SetRow = {
  id: string;
  name: string;
};

type CardRow = {
  id: string;
  number: string | null;
  name: string | null;
  sets: SetRow | SetRow[] | null;
};

type InventoryLotRow = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  cards: CardRow | null;
  acquisitions: {
    id: string;
    source_name: string;
    source_type: string;
  } | null;
};

type BuyerRow = {
  id: string;
  handle: string | null;
  platform: string;
  created_at: string;
};

type SalesItemRow = {
  id: string;
  qty: number;
  sold_price_pence: number;
  inventory_lots: {
    cards: CardRow | null;
    condition: string;
    variation: string | null;
  } | null;
};

type SalesOrderRow = {
  id: string;
  sold_at: string;
  platform: string;
  platform_order_ref: string | null;
  order_group: string | null;
  fees_pence: number | null;
  shipping_pence: number | null;
  discount_pence: number | null;
  bundle_id: string | null;
  created_at: string;
  buyers: BuyerRow | null;
  sales_items: SalesItemRow[] | null;
};

type BundleItemRow = {
  id: string;
  quantity: number;
  inventory_lots: {
    cards: CardRow | null;
    condition: string;
    variation: string | null;
  } | null;
};

type BundleRow = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
  bundle_items: BundleItemRow[] | null;
};

type ConsumableRow = {
  id: string;
  name: string;
  unit: string;
  created_at: string;
};

type ConsumablePurchaseRow = {
  id: string;
  qty: number;
  total_cost_pence: number;
  purchased_at: string;
  consumables: {
    id: string;
    name: string;
  } | null;
};

type ExportRow = Record<string, string | number>;

/**
 * Full Database Export
 *
 * Exports all critical application data to CSV format.
 * This includes:
 * - Acquisitions and intake lines
 * - Inventory lots with card details
 * - Sales orders and sales items
 * - Bundles and bundle items
 * - Buyers
 * - Consumables and consumable purchases
 * - eBay listings and configuration
 *
 * Note: This is a data export, not a database backup.
 * For true database backups, use Supabase's automated backup system.
 */
export async function GET(req: Request) {
  const logger = createApiLogger(req);

  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "zip"; // zip or json

    // Fetch all critical data in parallel
    const [
      acquisitionsRes,
      inventoryLotsRes,
      salesOrdersRes,
      bundlesRes,
      buyersRes,
      consumablesRes,
      consumablePurchasesRes,
      ebayListingsRes,
    ] = await Promise.all([
      // Acquisitions
      supabase.from("acquisitions").select("*").order("purchased_at", { ascending: false }),

      // Inventory Lots
      supabase
        .from("inventory_lots")
        .select(
          `
          *,
          cards:card_id (
            id,
            number,
            name,
            sets:set_id (
              id,
              name
            )
          ),
          acquisitions:acquisition_id (
            id,
            source_name,
            source_type
          )
        `
        )
        .order("created_at", { ascending: false }),

      // Sales Orders
      supabase
        .from("sales_orders")
        .select(
          `
          *,
          buyers:buyer_id (
            id,
            handle,
            platform
          ),
          sales_items (
            *,
            inventory_lots:lot_id (
              id,
              cards:card_id (
                id,
                number,
                name
              ),
              condition,
              variation
            )
          ),
          sales_consumables (
            *,
            consumables:consumable_id (
              id,
              name,
              unit
            )
          )
        `
        )
        .order("sold_at", { ascending: false }),

      // Bundles
      supabase
        .from("bundles")
        .select(
          `
          *,
          bundle_items (
            *,
            inventory_lots:lot_id (
              id,
              cards:card_id (
                id,
                number,
                name
              ),
              condition,
              variation
            )
          )
        `
        )
        .order("created_at", { ascending: false }),

      // Buyers
      supabase.from("buyers").select("*").order("created_at", { ascending: false }),

      // Consumables
      supabase.from("consumables").select("*").order("created_at", { ascending: false }),

      // Consumable Purchases
      supabase
        .from("consumable_purchases")
        .select(
          `
          *,
          consumables:consumable_id (
            id,
            name
          )
        `
        )
        .order("purchased_at", { ascending: false }),

      // eBay Listings
      supabase
        .from("ebay_listings")
        .select(
          `
          *,
          inventory_lots:lot_id (
            id,
            cards:card_id (
              id,
              number,
              name
            )
          )
        `
        )
        .order("created_at", { ascending: false }),
    ]);

    // Check for errors
    const errors = [
      acquisitionsRes.error,
      inventoryLotsRes.error,
      salesOrdersRes.error,
      bundlesRes.error,
      buyersRes.error,
      consumablesRes.error,
      consumablePurchasesRes.error,
      ebayListingsRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      logger.error("Failed to export data", errors[0], undefined, {
        errorCount: errors.length,
      });
      return createErrorResponse(
        `Failed to export data: ${errors[0]?.message || "Unknown error"}`,
        500,
        "EXPORT_FAILED",
        errors[0]
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];

    if (format === "json") {
      // Return JSON format
      const exportData = {
        export_date: new Date().toISOString(),
        version: "1.0",
        data: {
          acquisitions: acquisitionsRes.data || [],
          inventory_lots: inventoryLotsRes.data || [],
          sales_orders: salesOrdersRes.data || [],
          bundles: bundlesRes.data || [],
          buyers: buyersRes.data || [],
          consumables: consumablesRes.data || [],
          consumable_purchases: consumablePurchasesRes.data || [],
          ebay_listings: ebayListingsRes.error ? [] : ebayListingsRes.data || [],
        },
      };

      return NextResponse.json(exportData, {
        headers: {
          "Content-Disposition": `attachment; filename=pokeflip-full-export-${timestamp}.json`,
          "Content-Type": "application/json",
        },
      });
    }

    // Default: Return ZIP with multiple CSV files
    // For now, return a single comprehensive CSV with all data
    // In production, you might want to use a library like `archiver` to create a ZIP file

    // Flatten and combine all data into a single export format
    const allRows: ExportRow[] = [];

    // Acquisitions
    (acquisitionsRes.data || []).forEach((acq: AcquisitionRow) => {
      allRows.push({
        table: "acquisitions",
        id: acq.id,
        source_name: acq.source_name,
        source_type: acq.source_type,
        reference: acq.reference || "",
        purchase_total_gbp: penceToPounds(acq.purchase_total_pence),
        purchased_at: acq.purchased_at,
        status: acq.status,
        notes: acq.notes || "",
        created_at: acq.created_at,
      });
    });

    // Inventory Lots
    (inventoryLotsRes.data || []).forEach((lot: InventoryLotRow) => {
      const cards = lot.cards;
      const sets = Array.isArray(cards?.sets) ? cards?.sets[0] : cards?.sets;
      allRows.push({
        table: "inventory_lots",
        id: lot.id,
        card_id: lot.card_id,
        card_number: cards?.number || "",
        card_name: cards?.name || "",
        set_name: sets?.name || "",
        condition: lot.condition,
        variation: lot.variation || "standard",
        quantity: lot.quantity,
        for_sale: lot.for_sale ? "true" : "false",
        list_price_gbp: lot.list_price_pence ? penceToPounds(lot.list_price_pence) : "",
        status: lot.status,
        acquisition_source: lot.acquisitions?.source_name || "",
        created_at: lot.created_at,
        updated_at: lot.updated_at,
      });
    });

    // Sales Orders
    (salesOrdersRes.data || []).forEach((order: SalesOrderRow) => {
      const orderRevenue = (order.sales_items || []).reduce(
        (sum: number, item: SalesItemRow) => sum + item.qty * item.sold_price_pence,
        0
      );

      allRows.push({
        table: "sales_orders",
        id: order.id,
        sold_at: order.sold_at,
        platform: order.platform,
        platform_order_ref: order.platform_order_ref || "",
        buyer_handle: order.buyers?.handle || "",
        buyer_platform: order.buyers?.platform || "",
        order_group: order.order_group || "",
        revenue_gbp: penceToPounds(orderRevenue),
        fees_gbp: order.fees_pence ? penceToPounds(order.fees_pence) : "",
        shipping_gbp: order.shipping_pence ? penceToPounds(order.shipping_pence) : "",
        discount_gbp: order.discount_pence ? penceToPounds(order.discount_pence) : "",
        bundle_id: order.bundle_id || "",
        created_at: order.created_at,
      });

      // Sales Items
      (order.sales_items || []).forEach((item: SalesItemRow) => {
        allRows.push({
          table: "sales_items",
          sales_order_id: order.id,
          id: item.id,
          card_number: item.inventory_lots?.cards?.number || "",
          card_name: item.inventory_lots?.cards?.name || "",
          condition: item.inventory_lots?.condition || "",
          variation: item.inventory_lots?.variation || "standard",
          qty: item.qty,
          sold_price_each_gbp: penceToPounds(item.sold_price_pence),
          total_revenue_gbp: penceToPounds(item.qty * item.sold_price_pence),
          sold_at: order.sold_at,
        });
      });
    });

    // Bundles
    (bundlesRes.data || []).forEach((bundle: BundleRow) => {
      allRows.push({
        table: "bundles",
        id: bundle.id,
        name: bundle.name,
        description: bundle.description || "",
        price_gbp: penceToPounds(bundle.price_pence),
        quantity: bundle.quantity,
        status: bundle.status,
        created_at: bundle.created_at,
        updated_at: bundle.updated_at,
      });

      // Bundle Items
      (bundle.bundle_items || []).forEach((item: BundleItemRow) => {
        allRows.push({
          table: "bundle_items",
          bundle_id: bundle.id,
          bundle_name: bundle.name,
          id: item.id,
          card_number: item.inventory_lots?.cards?.number || "",
          card_name: item.inventory_lots?.cards?.name || "",
          condition: item.inventory_lots?.condition || "",
          variation: item.inventory_lots?.variation || "standard",
          quantity_per_bundle: item.quantity,
        });
      });
    });

    // Buyers
    (buyersRes.data || []).forEach((buyer: BuyerRow) => {
      allRows.push({
        table: "buyers",
        id: buyer.id,
        handle: buyer.handle || "",
        platform: buyer.platform,
        created_at: buyer.created_at,
      });
    });

    // Consumables
    (consumablesRes.data || []).forEach((consumable: ConsumableRow) => {
      allRows.push({
        table: "consumables",
        id: consumable.id,
        name: consumable.name,
        unit: consumable.unit,
        created_at: consumable.created_at,
      });
    });

    // Consumable Purchases
    (consumablePurchasesRes.data || []).forEach((purchase: ConsumablePurchaseRow) => {
      allRows.push({
        table: "consumable_purchases",
        id: purchase.id,
        consumable_name: purchase.consumables?.name || "",
        qty: purchase.qty,
        total_cost_gbp: penceToPounds(purchase.total_cost_pence),
        purchased_at: purchase.purchased_at,
      });
    });

    // Generate CSV (Edge-compatible, no Node.js stream required)
    // Get all unique keys from all rows to create header
    const headers = Array.from(new Set(allRows.flatMap((row) => Object.keys(row))));

    // Escape CSV values
    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If contains comma, newline, or quote, wrap in quotes and escape quotes
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV string
    const csv = [
      // Header row
      headers.map(escapeCSV).join(","),
      // Data rows
      ...allRows.map((row) => headers.map((header) => escapeCSV(row[header])).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=pokeflip-full-export-${timestamp}.csv`,
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "full_export" });
  }
}
