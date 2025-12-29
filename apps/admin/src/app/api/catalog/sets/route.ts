import { NextResponse } from "next/server";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";

export async function GET(req: Request) {
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
    console.error("[API] Error fetching sets:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to fetch sets",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
