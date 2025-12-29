import { useState, useEffect } from "react";
import { fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import type { TcgdxCard } from "@/lib/tcgdx/types";

export function useTcgdxCards(setId: string | null, locale: string = "en") {
  const [cards, setCards] = useState<TcgdxCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setId) {
      setCards([]);
      return;
    }

    const loadCards = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedCards = await fetchCardsForSet(setId, locale);
        setCards(fetchedCards);
      } catch (e: any) {
        setError(`Failed to load cards: ${e.message}`);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    void loadCards();
  }, [setId, locale]);

  return { cards, loading, error };
}

