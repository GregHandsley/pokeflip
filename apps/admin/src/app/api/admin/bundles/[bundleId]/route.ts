import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

// GET: Get a single bundle with items
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const logger = createApiLogger(req);
  
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
    return handleApiError(req, error, { operation: "get_bundle", metadata: { bundleId } });
  }
}

// DELETE: Delete a bundle
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const logger = createApiLogger(req);
  
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
      logger.error("Failed to delete bundle", error, undefined, { bundleId });
      return createErrorResponse(
        error.message || "Failed to delete bundle",
        500,
        "DELETE_BUNDLE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bundle deleted successfully",
    });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "delete_bundle", metadata: { bundleId } });
  }
}

