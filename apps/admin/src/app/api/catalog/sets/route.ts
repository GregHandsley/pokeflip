import { NextResponse } from "next/server";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";
import { handleApiError } from "@/lib/api-error-handler";
import { unstable_cache } from "next/cache";

// Cache catalog data for 1 hour (sets don't change frequently)
async function fetchSetsUncached(locale: string) {
  return await fetchAllSets(locale);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "en";

  try {
    const simplified = searchParams.get("simplified") === "true";

    // Use cached sets (revalidates every hour) - cache key includes locale
    const getCachedSets = unstable_cache(
      () => fetchSetsUncached(locale),
      [`catalog-sets-${locale}`],
      {
        revalidate: 3600, // 1 hour
        tags: ["catalog-sets"],
      }
    );

    const sets = await getCachedSets();

    // Return simplified format if requested (for backward compatibility)
    if (simplified) {
      const transformedSets = sets.map((s) => ({
        id: s.id,
        name: s.name,
        series: s.series?.name ?? undefined,
        releaseDate: s.releaseDate ?? undefined,
      }));
      return NextResponse.json({ ok: true, data: transformedSets });
    }

    // Return full set objects (client-side components need logo, symbol, etc.)
    return NextResponse.json({ ok: true, data: sets });
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_sets", metadata: { locale } });
  }
}
