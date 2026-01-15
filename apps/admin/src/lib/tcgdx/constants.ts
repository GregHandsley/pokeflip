/**
 * Constants for TCGdx integration
 */

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nameEn: "English" },
  { code: "fr", name: "Français", nameEn: "French" },
  { code: "de", name: "Deutsch", nameEn: "German" },
  { code: "it", name: "Italiano", nameEn: "Italian" },
  { code: "es", name: "Español", nameEn: "Spanish" },
  { code: "pt", name: "Português", nameEn: "Portuguese" },
  { code: "ja", name: "日本語", nameEn: "Japanese" },
  { code: "ko", name: "한국어", nameEn: "Korean" },
  { code: "zh-Hans", name: "简体中文", nameEn: "Simplified Chinese" },
  { code: "zh-Hant", name: "繁體中文", nameEn: "Traditional Chinese" },
] as const;

// Helper to get English name for a language code
export function getLanguageNameEn(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code || l.code === code.toLowerCase());
  return lang?.nameEn || code.toUpperCase();
}

export const CARD_CONDITIONS = [
  { value: "NM", label: "NM" },
  { value: "LP", label: "LP" },
  { value: "MP", label: "MP" },
  { value: "HP", label: "HP" },
  { value: "DMG", label: "DMG" },
] as const;

export type CardCondition = (typeof CARD_CONDITIONS)[number]["value"];
