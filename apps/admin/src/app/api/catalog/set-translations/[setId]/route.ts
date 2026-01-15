import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-error-handler";

/**
 * DELETE /api/catalog/set-translations/[setId]
 * Delete a set translation
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ setId: string }> }) {
  // const logger = createApiLogger(req);
  const { setId } = await params;

  try {
    const supabase = supabaseServer();

    const { error } = await supabase.from("set_translations").delete().eq("set_id", setId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "delete_set_translation", metadata: { setId } });
  }
}
