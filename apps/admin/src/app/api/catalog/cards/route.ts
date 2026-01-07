import { NextResponse } from "next/server";
import { fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const { searchParams } = new URL(req.url);
    const setId = searchParams.get("setId");
    const locale = searchParams.get("locale") || "en";

    if (!setId) {
      return NextResponse.json(
        { error: "Missing setId parameter" },
        { status: 400 }
      );
    }

    // Directly call TCGdx API - it's fast and doesn't need caching
    const cards = await fetchCardsForSet(setId, locale);
    
    return NextResponse.json({ ok: true, data: cards });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_cards", metadata: { setId, locale } });
  }
}
