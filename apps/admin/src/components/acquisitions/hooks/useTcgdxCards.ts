import { useState, useEffect, useRef } from "react";
import { fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import type { TcgdxCard } from "@/lib/tcgdx/types";
import { catalogCache, getCardsCacheKey } from "@/lib/cache/catalog-cache";

export function useTcgdxCards(setId: string | null, locale: string = "en") {
  const [cards, setCards] = useState<TcgdxCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!setId) {
      setCards([]);
      setLoading(false);
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadCards = async () => {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = getCardsCacheKey(setId, locale);

        // Use cache with 1 hour TTL - fetchCardsForSet will use API route which is also cached
        const fetchedCards = await catalogCache.get(
          cacheKey,
          async () => {
            return await fetchCardsForSet(setId, locale);
          },
          60 * 60 * 1000 // 1 hour
        );

        if (!abortController.signal.aborted) {
          setCards(fetchedCards);
        }
      } catch (e: unknown) {
        const isAbortError =
          (e instanceof Error && e.name === "AbortError") ||
          (typeof e === "object" &&
            e !== null &&
            "name" in e &&
            (e as { name: string }).name === "AbortError");

        if (!isAbortError && !abortController.signal.aborted) {
          setError(`Failed to load cards: ${e instanceof Error ? e.message : "Unknown error"}`);
          setCards([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadCards();

    return () => {
      abortController.abort();
    };
  }, [setId, locale]);

  return { cards, loading, error };
}
