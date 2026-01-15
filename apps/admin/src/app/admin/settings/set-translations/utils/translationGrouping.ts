import { SUPPORTED_LANGUAGES, getLanguageNameEn } from "@/lib/tcgdx/constants";
import type { SetTranslation } from "../types";

export function groupTranslations(
  translations: SetTranslation[]
): Record<string, SetTranslation[]> {
  return translations.reduce(
    (acc, translation) => {
      // Use source_language if available, otherwise group by source type
      const groupKey = translation.source_language || translation.source || "unknown";
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(translation);
      return acc;
    },
    {} as Record<string, SetTranslation[]>
  );
}

export function getLanguageName(code: string | null): string {
  if (!code) return "Unknown";
  return getLanguageNameEn(code);
}

export function sortTranslationGroups(
  groupedTranslations: Record<string, SetTranslation[]>
): Array<[string, SetTranslation[]]> {
  return Object.entries(groupedTranslations)
    .sort(([a], [b]) => {
      // Prioritize actual language codes
      const aIsLang = SUPPORTED_LANGUAGES.some((l) => l.code === a || l.code === a.toLowerCase());
      const bIsLang = SUPPORTED_LANGUAGES.some((l) => l.code === b || l.code === b.toLowerCase());

      if (aIsLang && !bIsLang) return -1;
      if (!aIsLang && bIsLang) return 1;

      return getLanguageName(a).localeCompare(getLanguageName(b));
    })
    .map(
      ([langCode, items]) =>
        [langCode, items.sort((a, b) => a.set_id.localeCompare(b.set_id))] as [
          string,
          SetTranslation[],
        ]
    );
}
