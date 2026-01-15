import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";
import { handleApiError } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

/**
 * Translate text using Google Translate API (free tier: 500k chars/month)
 * Falls back to MyMemory if Google fails
 */
async function translateText(text: string, sourceLang: string): Promise<string | null> {
  // Try Google Translate first (much higher free tier)
  try {
    // Google Translate API (free tier)
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const googleRes = await fetch(googleUrl);

    if (googleRes.ok) {
      const googleJson = await googleRes.json();
      const translated = googleJson?.[0]?.[0]?.[0];
      if (typeof translated === "string" && translated.trim().length > 0) {
        return translated.trim();
      }
    }
  } catch {
    // Fall through to MyMemory
  }

  // Fallback to MyMemory
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|en`;
    const myMemoryRes = await fetch(myMemoryUrl);

    if (myMemoryRes.ok && myMemoryRes.status !== 429 && myMemoryRes.status !== 403) {
      const myMemoryJson = await myMemoryRes.json();
      const translated = myMemoryJson?.responseData?.translatedText;
      if (typeof translated === "string" && translated.trim().length > 0) {
        return translated.trim();
      }
    }
  } catch {
    // Both failed
  }

  return null;
}

/**
 * POST /api/catalog/set-translations/bulk-import
 * Automatically import and translate all sets from TCGdx
 *
 * Body: { enabledLocales: string[] } - which languages to import
 */
export async function POST(req: Request) {
  const logger = createApiLogger(req);
  let enabledLocales: string[] = [];

  try {
    const body = await req.json();
    enabledLocales = body.enabledLocales || []; // No default - user selects languages

    if (!Array.isArray(enabledLocales) || enabledLocales.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one language to import" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Step 1: Get existing translations to avoid re-translating
    const { data: existing, error: existingError } = await supabase
      .from("set_translations")
      .select("set_id");

    if (existingError) {
      logger.error("Failed to fetch existing translations", existingError, undefined, {
        enabledLocalesCount: enabledLocales.length,
      });
      // If table doesn't exist, return helpful error
      if (existingError.message?.includes("does not exist") || existingError.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "Database table 'set_translations' does not exist. Please run migrations: npx supabase migration up",
            migrationRequired: true,
          },
          { status: 500 }
        );
      }
      throw existingError;
    }

    const existingSetIds = new Set((existing || []).map((r) => r.set_id));

    // Step 2: Fetch all sets from enabled locales
    // Map locale codes to TCGdx API format
    const localeToCode: Record<string, string> = {
      "zh-Hans": "zh-Hans",
      "zh-Hant": "zh-Hant",
      zh: "zh-Hant", // Fallback for zh
    };

    const allSetsByLocale = new Map<string, Array<{ id: string; name: string }>>();

    // Fetch sets for each enabled locale
    for (const locale of enabledLocales) {
      try {
        const code = localeToCode[locale] || locale;
        const sets = await fetchAllSets(code);
        allSetsByLocale.set(locale, sets);
      } catch (e: unknown) {
        console.warn(
          `Failed to fetch sets for locale ${locale}:`,
          e instanceof Error ? e.message : String(e)
        );
        // Continue with other locales
      }
    }

    // Step 3: Create a unified map of all sets (English is not included - use API directly)
    const allSets = new Map<string, { id: string; name: string; locale: string }>();

    // Add all locale sets (English is excluded from import)
    for (const [locale, sets] of allSetsByLocale.entries()) {
      sets.forEach((set) => {
        if (!allSets.has(set.id)) {
          allSets.set(set.id, { id: set.id, name: set.name, locale });
        }
      });
    }

    // Step 4: Prepare translations to insert
    const translationsToInsert: Array<{ set_id: string; name_en: string; source: string }> = [];

    // Step 5: Translate all sets (all need translation since English is excluded)
    const setsToTranslate = Array.from(allSets.values()).filter(
      (set) => !existingSetIds.has(set.id)
    );

    // Translate in batches with small delays
    const BATCH_SIZE = 10; // Google Translate can handle more
    const DELAY_MS = 500; // Smaller delay for Google

    for (let i = 0; i < setsToTranslate.length; i += BATCH_SIZE) {
      const batch = setsToTranslate.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (set) => {
        try {
          // Map locale to translation API format
          const translateLang =
            set.locale === "zh-Hans" ? "zh-CN" : set.locale === "zh-Hant" ? "zh-TW" : set.locale;
          const translated = await translateText(set.name, translateLang);
          if (translated) {
            return {
              set_id: set.id,
              name_en: translated,
              source: "translated",
            };
          }
          return null;
        } catch (e) {
          console.warn(`Translation error for set ${set.id}:`, e);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Add successful translations
      batchResults.forEach((result) => {
        if (result) {
          translationsToInsert.push(result);
        }
      });

      // Small delay between batches
      if (i + BATCH_SIZE < setsToTranslate.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    // Step 6: Insert all translations into database
    if (translationsToInsert.length > 0) {
      const { error } = await supabase
        .from("set_translations")
        .upsert(translationsToInsert, { onConflict: "set_id" });

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      imported: translationsToInsert.length,
      translatedSets: translationsToInsert.length,
      localesProcessed: enabledLocales,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "bulk_import_set_translations",
      metadata: { enabledLocalesCount: enabledLocales.length },
    });
  }
}
