import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const body = await req.json();
    const {
      name,
      description,
      deal_type,
      discount_percent,
      discount_amount_pence,
      buy_quantity,
      get_quantity,
      min_card_count,
      max_card_count,
      is_active,
    } = body;

    const supabase = supabaseServer();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (deal_type !== undefined) updateData.deal_type = deal_type;
    if (discount_percent !== undefined) updateData.discount_percent = discount_percent ? parseFloat(discount_percent) : null;
    if (discount_amount_pence !== undefined) updateData.discount_amount_pence = discount_amount_pence ? parseInt(discount_amount_pence, 10) : null;
    if (buy_quantity !== undefined) updateData.buy_quantity = buy_quantity ? parseInt(buy_quantity, 10) : null;
    if (get_quantity !== undefined) updateData.get_quantity = get_quantity ? parseInt(get_quantity, 10) : null;
    if (min_card_count !== undefined) updateData.min_card_count = min_card_count ? parseInt(min_card_count, 10) : 1;
    if (max_card_count !== undefined) updateData.max_card_count = max_card_count ? parseInt(max_card_count, 10) : null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: deal, error } = await supabase
      .from("promotional_deals")
      .update(updateData)
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      console.error("Error updating promotional deal:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update promotional deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deal,
    });
  } catch (error: any) {
    console.error("Error in update promotional deal API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const supabase = supabaseServer();

    const { error } = await supabase
      .from("promotional_deals")
      .delete()
      .eq("id", dealId);

    if (error) {
      console.error("Error deleting promotional deal:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete promotional deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("Error in delete promotional deal API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


