import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { poundsToPence } from "@pokeflip/shared";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  try {
    const { lineId } = await params;
    const body = await req.json();
    const { split_qty, for_sale, list_price_pence, condition } = body;

    if (!split_qty || split_qty < 1) {
      return NextResponse.json(
        { error: "Invalid split quantity" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch the original line
    const { data: originalLine, error: fetchError } = await supabase
      .from("intake_lines")
      .select("*")
      .eq("id", lineId)
      .single();

    if (fetchError || !originalLine) {
      return NextResponse.json(
        { error: "Intake line not found" },
        { status: 404 }
      );
    }

    if (split_qty >= originalLine.quantity) {
      return NextResponse.json(
        { error: "Split quantity must be less than current quantity" },
        { status: 400 }
      );
    }

    // Create the new split line
    const newLine: any = {
      acquisition_id: originalLine.acquisition_id,
      set_id: originalLine.set_id,
      card_id: originalLine.card_id,
      condition: condition || originalLine.condition,
      quantity: split_qty,
      for_sale: for_sale ?? originalLine.for_sale,
      list_price_pence: list_price_pence != null ? poundsToPence(list_price_pence) : originalLine.list_price_pence,
      note: originalLine.note,
      status: "draft",
    };

    const { data: createdLine, error: insertError } = await supabase
      .from("intake_lines")
      .insert({
        ...newLine,
        variation: originalLine.variation || "standard",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating split line:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to create split line" },
        { status: 500 }
      );
    }

    // Update the original line's quantity
    const newQuantity = originalLine.quantity - split_qty;
    const { error: updateError } = await supabase
      .from("intake_lines")
      .update({ quantity: newQuantity })
      .eq("id", lineId);

    if (updateError) {
      console.error("Error updating original line:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update original line" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      original_line: { id: lineId, quantity: newQuantity },
      split_line: createdLine,
    });
  } catch (error: any) {
    console.error("Error in split API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

