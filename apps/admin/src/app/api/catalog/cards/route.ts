import { NextResponse } from "next/server";
import { fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import { handleApiError } from "@/lib/api-error-handler";
import { unstable_cache } from "next/cache";

// Cache catalog data for 1 hour (cards don't change frequently)
async function fetchCardsUncached(setId: string, locale: string) {
  return await fetchCardsForSet(setId, locale);
}

export async function GET(req: Request) {
  // const logger = createApiLogger(req);
  const { searchParams } = new URL(req.url);
  const setId = searchParams.get("setId");
  const locale = searchParams.get("locale") || "en";

  try {
    if (!setId) {
      return NextResponse.json({ error: "Missing setId parameter" }, { status: 400 });
    }

    // Use cached cards (revalidates every hour) - cache key includes setId and locale
    const getCachedCards = unstable_cache(
      () => fetchCardsUncached(setId, locale),
      [`catalog-cards-${setId}-${locale}`],
      {
        revalidate: 3600, // 1 hour
        tags: ["catalog-cards"],
      }
    );

    const cards = await getCachedCards();

    return NextResponse.json({ ok: true, data: cards });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_cards", metadata: { setId, locale } });
  }
}
