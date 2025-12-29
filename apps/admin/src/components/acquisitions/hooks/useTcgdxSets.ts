import { useState, useEffect } from "react";
import { fetchAllSets } from "@/lib/tcgdx/tcgdxClient";
import type { TcgdxSet } from "@/lib/tcgdx/types";

export function useTcgdxSets(locale: string = "en") {
  const [sets, setSets] = useState<TcgdxSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSets = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedSets = await fetchAllSets(locale);
        setSets(fetchedSets);
      } catch (e: any) {
        setError(`Failed to load sets: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (locale) {
      void loadSets();
    }
  }, [locale]);

  return { sets, loading, error };
}

