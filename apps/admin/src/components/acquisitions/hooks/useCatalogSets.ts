import { useState, useEffect } from "react";
import type { TcgSet } from "@/lib/tcgdx/types";

export function useCatalogSets() {
  const [sets, setSets] = useState<TcgSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/catalog/sets");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load sets");
        setSets(json.data || []);
      } catch (e: any) {
        setError(`Failed to load sets: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    void loadSets();
  }, []);

  return { sets, loading, error };
}

