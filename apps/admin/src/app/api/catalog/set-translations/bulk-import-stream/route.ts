import { supabaseServer } from "@/lib/supabase/server";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";
import { createApiLogger } from "@/lib/logger";

// Helper function to convert text to title case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Handle special cases like "ex", "v", "vmax", etc.
      if (word === 'ex' || word === 'v' || word === 'vmax' || word === 'vstar' || word === 'gx') {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Translate text using Google Translate API (free tier: 500k chars/month)
 * Falls back to MyMemory if Google fails
 */
async function translateText(text: string, sourceLang: string): Promise<string | null> {
  // Try Google Translate first (much higher free tier)
  try {
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const googleRes = await fetch(googleUrl);
    
    if (googleRes.ok) {
      const googleJson = await googleRes.json();
      const translated = googleJson?.[0]?.[0]?.[0];
      if (typeof translated === "string" && translated.trim().length > 0) {
        console.log(`✓ Google Translate: "${text}" (${sourceLang}) → "${translated}"`);
        return translated.trim();
      } else {
        console.warn(`Google Translate returned invalid result for "${text}":`, googleJson);
      }
    } else {
      console.warn(`Google Translate failed with status ${googleRes.status} for "${text}"`);
    }
  } catch (e: any) {
    console.warn(`Google Translate error for "${text}":`, e.message);
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
        console.log(`✓ MyMemory: "${text}" (${sourceLang}) → "${translated}"`);
        return translated.trim();
      } else {
        console.warn(`MyMemory returned invalid result for "${text}":`, myMemoryJson);
      }
    } else {
      console.warn(`MyMemory failed with status ${myMemoryRes.status} for "${text}"`);
    }
  } catch (e: any) {
    console.warn(`MyMemory error for "${text}":`, e.message);
  }
  
  logger.warn(`Both translation APIs failed`, undefined, undefined, { text, sourceLang });
  return null;
}

/**
 * POST /api/catalog/set-translations/bulk-import-stream
 * Stream progress updates via Server-Sent Events
 */
export async function POST(req: Request) {
  const logger = createApiLogger(req);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await req.json();
        const { enabledLocales = [] } = body;

        if (!Array.isArray(enabledLocales) || enabledLocales.length === 0) {
          sendProgress({ error: "Please select at least one language to import" });
          controller.close();
          return;
        }

        const supabase = supabaseServer();

        sendProgress({ stage: "fetching", message: "Fetching existing translations..." });

        // Get existing translations
        const { data: existing, error: existingError } = await supabase
          .from("set_translations")
          .select("set_id");

        if (existingError) {
          if (existingError.message?.includes("does not exist") || (existingError as any).code === "42P01") {
            sendProgress({ 
              error: "Database table 'set_translations' does not exist. Please run migrations.",
              migrationRequired: true
            });
            controller.close();
            return;
          }
          throw existingError;
        }

        const existingSetIds = new Set((existing || []).map((r) => r.set_id));

        // Fetch sets from enabled locales
        const localeToCode: Record<string, string> = {
          "zh-Hans": "zh-Hans",
          "zh-Hant": "zh-Hant",
          "zh": "zh-Hant",
        };

        const allSetsByLocale = new Map<string, Array<{ id: string; name: string }>>();

        sendProgress({ stage: "fetching", message: `Fetching sets from ${enabledLocales.length} language(s)...` });

        for (let i = 0; i < enabledLocales.length; i++) {
          const locale = enabledLocales[i];
          try {
            const code = localeToCode[locale] || locale;
            sendProgress({ 
              stage: "fetching", 
              message: `Fetching ${locale} sets...`,
              progress: { current: i + 1, total: enabledLocales.length }
            });
            const sets = await fetchAllSets(code);
            allSetsByLocale.set(locale, sets);
          } catch (e: any) {
            console.warn(`Failed to fetch sets for locale ${locale}:`, e.message);
            sendProgress({ 
              warning: `Failed to fetch sets for ${locale}: ${e.message}` 
            });
          }
        }

        // Create unified map
        const allSets = new Map<string, { id: string; name: string; locale: string }>();
        for (const [locale, sets] of allSetsByLocale.entries()) {
          sets.forEach((set) => {
            if (!allSets.has(set.id)) {
              allSets.set(set.id, { id: set.id, name: set.name, locale });
            }
          });
        }

        const setsToTranslate = Array.from(allSets.values()).filter(
          (set) => !existingSetIds.has(set.id)
        );

        sendProgress({ 
          stage: "translating", 
          message: `Translating ${setsToTranslate.length} sets...`,
          progress: { current: 0, total: setsToTranslate.length }
        });

        let savedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const DELAY_MS = 300; // Small delay between translations

        sendProgress({
          stage: "info",
          message: `Found ${setsToTranslate.length} sets to translate. ${existingSetIds.size} already exist in database.`,
        });

        // Process one set at a time: translate, save, then move to next
        for (let i = 0; i < setsToTranslate.length; i++) {
          const set = setsToTranslate[i];
          const sourceLanguage = set.locale; // Track which language this set came from

          try {
            // Translate
            const translateLang = set.locale === "zh-Hans" ? "zh-CN" : 
                                  set.locale === "zh-Hant" ? "zh-TW" : 
                                  set.locale;
            
            sendProgress({
              stage: "translating",
              message: `Translating "${set.name}" (${set.id})...`,
              progress: { current: i + 1, total: setsToTranslate.length }
            });

            const translated = await translateText(set.name, translateLang);

            if (translated) {
              // Save immediately
              sendProgress({
                stage: "saving",
                message: `Saving "${translated}" (${set.id})...`,
                progress: { current: i + 1, total: setsToTranslate.length }
              });

              // First, ensure the set exists in the sets table (foreign key requirement)
              const { data: existingSet } = await supabase
                .from("sets")
                .select("id")
                .eq("id", set.id)
                .single();

              if (!existingSet) {
                // Set doesn't exist in database - we need to create it first
                // Try to fetch the set from TCGdx in English
                try {
                  const englishSets = await fetchAllSets("en");
                  const englishSet = englishSets.find((s) => s.id === set.id);
                  
                  if (englishSet) {
                    const { error: setError } = await supabase.from("sets").upsert({
                      id: englishSet.id,
                      name: englishSet.name,
                      series: englishSet.series?.name ?? null,
                      release_date: englishSet.releaseDate
                        ? englishSet.releaseDate.replaceAll("/", "-").slice(0, 10)
                        : null,
                      api_payload: englishSet,
                    });

                    if (setError) {
                      logger.error(`Failed to create set during bulk import`, setError, undefined, { setId: set.id });
                      sendProgress({
                        warning: `Set ${set.id} doesn't exist in database and couldn't be created: ${setError.message}`
                      });
                      skippedCount++;
                      continue;
                    } else {
                      logger.info(`Created set in database`, undefined, undefined, { setId: set.id });
                    }
                  } else {
                    // If English doesn't exist, create with the translated name
                    const { error: setError } = await supabase.from("sets").upsert({
                      id: set.id,
                      name: translated, // Use translated name as fallback
                      series: null,
                      release_date: null,
                      api_payload: {},
                    });

                    if (setError) {
                      logger.error(`Failed to create set during bulk import`, setError, undefined, { setId: set.id });
                      sendProgress({
                        warning: `Set ${set.id} doesn't exist in database and couldn't be created: ${setError.message}`
                      });
                      skippedCount++;
                      continue;
                    } else {
                      logger.info(`Created set in database with translated name`, undefined, undefined, { setId: set.id });
                    }
                  }
                } catch (e: any) {
                  console.warn(`Failed to fetch/create set ${set.id}:`, e);
                  sendProgress({
                    warning: `Failed to create set ${set.id}: ${e.message}`
                  });
                  continue;
                }
              }

              const { error: saveError, data: saveData } = await supabase
                .from("set_translations")
                .upsert({
                  set_id: set.id,
                  name_en: toTitleCase(translated),
                  source: "translated",
                  source_language: sourceLanguage,
                }, { onConflict: "set_id" });

              if (saveError) {
                logger.error(`Failed to save translation during bulk import`, saveError, undefined, { setId: set.id });
                sendProgress({
                  warning: `Failed to save ${set.id}: ${saveError.message}`
                });
              } else {
                savedCount++;
                console.log(`✓ Saved translation for ${set.id}: "${translated}"`);
              }
            } else {
              failedCount++;
              console.warn(`Translation returned null for ${set.id} (${set.name}) from locale ${set.locale}`);
              sendProgress({
                warning: `Translation failed for ${set.id} (${set.name}), skipping...`
              });
            }
          } catch (e: any) {
            failedCount++;
            logger.error(`Error processing set during bulk import`, e instanceof Error ? e : new Error(String(e)), undefined, { setId: set.id });
            sendProgress({
              warning: `Error processing ${set.id}: ${e.message}`
            });
          }

          // Small delay to avoid rate limiting
          if (i < setsToTranslate.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
          }
        }

        sendProgress({
          stage: "complete",
          message: `Import complete! ${savedCount} translations saved, ${failedCount} failed, ${skippedCount} skipped.`,
          result: {
            imported: savedCount,
            translatedSets: savedCount,
            failed: failedCount,
            skipped: skippedCount,
            localesProcessed: enabledLocales,
            totalProcessed: setsToTranslate.length,
          }
        });

        controller.close();
      } catch (error: any) {
        logger.error("Error in bulk import stream", error instanceof Error ? error : new Error(String(error)));
        sendProgress({
          error: error.message || "Failed to bulk import translations",
          details: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

