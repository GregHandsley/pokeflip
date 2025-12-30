import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { use_api_image } = body;

    if (typeof use_api_image !== "boolean") {
      return NextResponse.json(
        { error: "use_api_image must be a boolean" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Update the lot
    const { error } = await supabase
      .from("inventory_lots")
      .update({ use_api_image })
      .eq("id", lotId);

    if (error) {
      console.error("Error updating use_api_image flag:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update use_api_image flag" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `API image flag ${use_api_image ? "enabled" : "disabled"}`,
    });
  } catch (error: any) {
    console.error("Error in use-api-image API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

