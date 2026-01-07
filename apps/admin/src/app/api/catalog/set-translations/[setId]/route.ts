import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

/**
 * DELETE /api/catalog/set-translations/[setId]
 * Delete a set translation
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const logger = createApiLogger(req);
  
  try {
    const { setId } = await params;
    const supabase = supabaseServer();
    
    const { error } = await supabase
      .from("set_translations")
      .delete()
      .eq("set_id", setId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "delete_set_translation", metadata: { setId } });
  }
}


