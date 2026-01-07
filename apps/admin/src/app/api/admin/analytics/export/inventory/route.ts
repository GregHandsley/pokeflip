import { NextResponse } from "next/server";
import { Parser } from "json2csv";
import { penceToPounds } from "@pokeflip/shared";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("inventory_lots")
      .select(
        `
        id,
        status,
        condition,
        quantity,
        for_sale,
        list_price_pence,
        created_at,
        updated_at,
        variation,
        cards:card_id (
          number,
          name,
          sets:set_id ( name )
        ),
        acquisitions:acquisition_id (
          source_name,
          source_type,
          purchased_at
        )
      `
      );

    if (error) {
      logger.error("Failed to generate inventory export", error);
      return createErrorResponse(
        "Failed to generate inventory export",
        500,
        "INVENTORY_EXPORT_FAILED",
        error
      );
    }

    const rows =
      data?.map((row) => ({
        lot_id: row.id,
        status: row.status,
        condition: row.condition,
        quantity: row.quantity,
        for_sale: row.for_sale,
        list_price_gbp:
          row.list_price_pence != null
            ? penceToPounds(row.list_price_pence)
            : "",
        card_number: row.cards?.number || "",
        card_name: row.cards?.name || "",
        set_name: row.cards?.sets?.name || "",
        variation: row.variation || "standard",
        source_name: row.acquisitions?.source_name || "",
        source_type: row.acquisitions?.source_type || "",
        purchased_at: row.acquisitions?.purchased_at || "",
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) || [];

    const parser = new Parser();
    const csv = parser.parse(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=inventory.csv",
      },
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "export_inventory" });
  }
}

