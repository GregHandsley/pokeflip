import { useState, useEffect, useRef } from "react";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";
import type { TcgdxSet } from "@/lib/tcgdx/types";
import { catalogCache, getSetsCacheKey } from "@/lib/cache/catalog-cache";

export function useTcgdxSets(locale: string = "en") {
  const [sets, setSets] = useState<TcgdxSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!locale) {
      return;
    }

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

        // Use cache with 1 hour TTL - fetchAllSets will use API route which is also cached
        const fetchedSets = await catalogCache.get(
          cacheKey,
          async () => {
            return await fetchAllSets(locale);
          },
          60 * 60 * 1000 // 1 hour
        );

        if (!abortController.signal.aborted) {
          setSets(fetchedSets);
        }
      } catch (e: unknown) {
        const isAbortError =
          (e instanceof Error && e.name === "AbortError") ||
          (typeof e === "object" &&
            e !== null &&
            "name" in e &&
            (e as { name: string }).name === "AbortError");

        if (!isAbortError && !abortController.signal.aborted) {
          setError(`Failed to load sets: ${e instanceof Error ? e.message : "Unknown error"}`);
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
