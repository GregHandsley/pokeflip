import { NextResponse } from "next/server";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale") || "en";

    // Directly call TCGdx API - it's fast and doesn't need caching
    const sets = await fetchAllSets(locale);
    
    // Transform to match expected format
    const transformedSets = sets.map((s) => ({
      id: s.id,
      name: s.name,
      series: s.series?.name ?? undefined,
      releaseDate: s.releaseDate ?? undefined,
    }));

    return NextResponse.json({ ok: true, data: transformedSets });
  } catch (error: any) {
    return handleApiError(req, error, { operation: "get_sets", metadata: { locale } });
  }
}
