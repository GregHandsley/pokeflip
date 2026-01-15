/**
 * English display name overrides for sets that only exist in JP/CH locales.
 * These are now stored in the database (set_translations table), but kept here
 * as a fallback and for initial migration.
 */
export const SET_ENGLISH_NAME_OVERRIDES: Record<string, string> = {
  sv1a: "Triplet Beat",
  sv2a: "Snow Hazard / Clay Burst",
  sv3a: "Raging Surf",
  sv4a: "Shiny Treasure ex",
};

// Helper function to convert text to title case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      // Handle special cases like "ex", "v", "vmax", etc.
      if (word === "ex" || word === "v" || word === "vmax" || word === "vstar" || word === "gx") {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Get the best available English display name for a set.
 * Priority: database translations > English API names > code overrides > fallback
 * Returns title-cased name for consistent display
 */
export function getSetDisplayName(
  setId: string,
  fallbackName: string,
  englishSetNames: Record<string, string>,
  dbTranslations?: Record<string, string>
) {
  const name =
    dbTranslations?.[setId] ??
    englishSetNames[setId] ??
    SET_ENGLISH_NAME_OVERRIDES[setId] ??
    fallbackName;
  return toTitleCase(name);
}
