import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/catalog/set-translations
 * Fetch all set translations (English display names) from database
 */
export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("set_translations")
      .select("set_id, name_en, source, source_language, created_at, updated_at")
      .order("set_id");

    if (error) {
      throw error;
    }

    // Return as a map for easy lookup (for CardPicker) and full array (for settings page)
    const translations: Record<string, string> = {};
    (data || []).forEach((row) => {
      translations[row.set_id] = row.name_en;
    });

    return NextResponse.json({ 
      ok: true, 
      translations, // Map for easy lookup
      translationsList: data || [] // Full array for settings page
    });
  } catch (error: any) {
    console.error("[API] Error fetching set translations:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch set translations",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/catalog/set-translations
 * Upsert set translations (for manual curation or bulk import)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { translations } = body; // Array of { set_id, name_en, source? }

    if (!Array.isArray(translations)) {
      return NextResponse.json(
        { error: "translations must be an array" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const { error } = await supabase.from("set_translations").upsert(
      translations.map((t) => ({
        set_id: t.set_id,
        name_en: t.name_en,
        source: t.source || "manual",
        source_language: t.source_language || null,
      })),
      { onConflict: "set_id" }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, count: translations.length });
  } catch (error: any) {
    console.error("[API] Error upserting set translations:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to upsert set translations",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

