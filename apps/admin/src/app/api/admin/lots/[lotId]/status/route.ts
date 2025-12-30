import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const validStatuses = ["draft", "ready", "listed", "sold", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Update the lot status
    const { error } = await supabase
      .from("inventory_lots")
      .update({ status })
      .eq("id", lotId);

    if (error) {
      console.error("Error updating lot status:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update lot status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Lot status updated to ${status}`,
    });
  } catch (error: any) {
    console.error("Error in update lot status API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

