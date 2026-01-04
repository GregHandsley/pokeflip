import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// GET: Get a single bundle with items
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  try {
    const { bundleId } = await params;
    const supabase = supabaseServer();

    const { data: bundle, error } = await supabase
      .from("bundles")
      .select(`
        *,
        bundle_items (
          id,
          quantity,
          inventory_lots (
            id,
            quantity,
            condition,
            variation,
            cards (
              id,
              number,
              name,
              api_image_url,
              sets (
                id,
                name
              )
            )
          )
        )
      `)
      .eq("id", bundleId)
      .single();

    if (error || !bundle) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      bundle,
    });
  } catch (error: any) {
    console.error("Error in get bundle API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a bundle
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  try {
    const { bundleId } = await params;
    const supabase = supabaseServer();

    // Check if bundle has been sold
    const { data: salesOrders } = await supabase
      .from("sales_orders")
      .select("id")
      .eq("bundle_id", bundleId)
      .limit(1);

    if (salesOrders && salesOrders.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete bundle that has been sold" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("bundles")
      .delete()
      .eq("id", bundleId);

    if (error) {
      console.error("Error deleting bundle:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete bundle" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bundle deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete bundle API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

