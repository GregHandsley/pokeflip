import { NextResponse } from "next/server";
import { fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";

export async function GET(req: Request) {
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
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
