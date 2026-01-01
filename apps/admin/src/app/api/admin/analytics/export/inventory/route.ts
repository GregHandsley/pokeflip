import { NextResponse } from "next/server";
import { Parser } from "json2csv";
import { penceToPounds } from "@pokeflip/shared";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
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
      console.error("Inventory export error:", error);
      return NextResponse.json(
        { error: "Failed to generate inventory export" },
        { status: 500 }
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
    console.error("Inventory export exception:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

