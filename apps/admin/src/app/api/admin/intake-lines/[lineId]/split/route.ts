export const runtime = "edge";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { poundsToPence } from "@pokeflip/shared";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function POST(req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const logger = createApiLogger(req);

  // Extract lineId outside try block so it's available in catch
  const { lineId } = await params;

  try {
    const body = await req.json();
    const { split_qty, for_sale, list_price_pence, condition } = body;

    if (!split_qty || split_qty < 1) {
      return NextResponse.json({ error: "Invalid split quantity" }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch the original line
    const { data: originalLine, error: fetchError } = await supabase
      .from("intake_lines")
      .select("*")
      .eq("id", lineId)
      .single();

    if (fetchError || !originalLine) {
      return NextResponse.json({ error: "Intake line not found" }, { status: 404 });
    }

    if (split_qty >= originalLine.quantity) {
      return NextResponse.json(
        { error: "Split quantity must be less than current quantity" },
        { status: 400 }
      );
    }

    // Create the new split line
    const newLine: {
      acquisition_id: string;
      card_id: string;
      set_id: string;
      condition: string;
      variation: string;
      quantity: number;
      for_sale: boolean;
      list_price_pence: number | null;
      note: string | null;
    } = {
      acquisition_id: originalLine.acquisition_id,
      set_id: originalLine.set_id,
      card_id: originalLine.card_id,
      condition: condition || originalLine.condition,
      variation: originalLine.variation || "standard",
      quantity: split_qty,
      for_sale: for_sale ?? originalLine.for_sale,
      list_price_pence:
        list_price_pence != null ? poundsToPence(list_price_pence) : originalLine.list_price_pence,
      note: originalLine.note,
    };

    const { data: createdLine, error: insertError } = await supabase
      .from("intake_lines")
      .insert(newLine)
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create split line", insertError, undefined, { lineId, split_qty });
      return createErrorResponse(
        insertError.message || "Failed to create split line",
        500,
        "CREATE_SPLIT_LINE_FAILED",
        insertError
      );
    }

    // Update the original line's quantity
    const newQuantity = originalLine.quantity - split_qty;
    const { error: updateError } = await supabase
      .from("intake_lines")
      .update({ quantity: newQuantity })
      .eq("id", lineId);

    if (updateError) {
      logger.error("Failed to update original line after split", updateError, undefined, {
        lineId,
        newQuantity,
      });
      return createErrorResponse(
        updateError.message || "Failed to update original line",
        500,
        "UPDATE_ORIGINAL_LINE_FAILED",
        updateError
      );
    }

    return NextResponse.json({
      ok: true,
      original_line: { id: lineId, quantity: newQuantity },
      split_line: createdLine,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "split_intake_line", metadata: { lineId } });
  }
}
