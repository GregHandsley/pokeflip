import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// POST: Add a lot to an existing bundle
export async function POST(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  try {
    const { bundleId } = await params;
    const body = await req.json();
    const { lotId, quantity = 1 } = body;

    if (!lotId) {
      return NextResponse.json(
        { error: "Missing required field: lotId" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verify bundle exists and is not sold
    const { data: bundle, error: bundleError } = await supabase
      .from("bundles")
      .select("id, status")
      .eq("id", bundleId)
      .single();

    if (bundleError || !bundle) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    if (bundle.status === "sold") {
      return NextResponse.json(
        { error: "Cannot add items to a sold bundle" },
        { status: 400 }
      );
    }

    // Verify the lot exists and is for sale
    const { data: lot, error: lotError } = await supabase
      .from("inventory_lots")
      .select("id, for_sale, status")
      .eq("id", lotId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      );
    }

    if (!lot.for_sale) {
      return NextResponse.json(
        { error: "Cannot add cards that are not for sale to bundles" },
        { status: 400 }
      );
    }

    // Check if lot already exists in bundle
    const { data: existingItem } = await supabase
      .from("bundle_items")
      .select("id, quantity")
      .eq("bundle_id", bundleId)
      .eq("lot_id", lotId)
      .single();

    if (existingItem) {
      // Update quantity if item already exists
      const { error: updateError } = await supabase
        .from("bundle_items")
        .update({ quantity: existingItem.quantity + quantity })
        .eq("id", existingItem.id);

      if (updateError) {
        console.error("Error updating bundle item:", updateError);
        return NextResponse.json(
          { error: updateError.message || "Failed to update bundle item" },
          { status: 500 }
        );
      }
    } else {
      // Insert new bundle item
      const { error: insertError } = await supabase
        .from("bundle_items")
        .insert({
          bundle_id: bundleId,
          lot_id: lotId,
          quantity: quantity,
        });

      if (insertError) {
        console.error("Error adding bundle item:", insertError);
        return NextResponse.json(
          { error: insertError.message || "Failed to add item to bundle" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Item added to bundle successfully",
    });
  } catch (error: any) {
    console.error("Error in add bundle item API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

