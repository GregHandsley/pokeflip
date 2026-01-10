import { useState, useEffect, useRef } from "react";
import type { TcgSet } from "@/lib/tcgdx/types";
import { catalogCache, getSetsCacheKey } from "@/lib/cache/catalog-cache";

export function useCatalogSets() {
  const [sets, setSets] = useState<TcgSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = "en"; // Default locale, could be made configurable
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadSets = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const cacheKey = getSetsCacheKey(locale);
        
        // Use cache with 1 hour TTL
        const cachedSets = await catalogCache.get(
          cacheKey,
          async () => {
            const res = await fetch("/api/catalog/sets?simplified=true", {
              signal: abortController.signal,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to load sets");
            return json.data || [];
          },
          60 * 60 * 1000 // 1 hour
        );

        if (!abortController.signal.aborted) {
          setSets(cachedSets);
        }
      } catch (e: any) {
        if (e.name !== "AbortError" && !abortController.signal.aborted) {
          setError(`Failed to load sets: ${e.message}`);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadSets();

    return () => {
      abortController.abort();
    };
  }, [locale]);

  return { sets, loading, error };
}

