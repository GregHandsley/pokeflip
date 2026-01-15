import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import type { SetTranslation } from "../types";

export function useSetTranslations() {
  const [translations, setTranslations] = useState<SetTranslation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/set-translations");
      const json = await res.json();
      if (json.ok) {
        // Use translationsList if available (full objects), otherwise convert map
        if (json.translationsList && Array.isArray(json.translationsList)) {
          setTranslations(json.translationsList as SetTranslation[]);
        } else {
          // Fallback: convert translations map to array
          const translationsArray: SetTranslation[] = Object.entries(json.translations || {}).map(
            ([set_id, name_en]) => ({
              set_id,
              name_en: name_en as string,
              source: "manual",
              source_language: "en",
              created_at: "",
              updated_at: "",
            })
          );
          setTranslations(translationsArray);
        }
      }
    } catch (e) {
      logger.error("Failed to load set translations", e);
      setError("Failed to load translations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  return {
    translations,
    loading,
    error,
    loadTranslations,
  };
}
