import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { logger } from "@/lib/logger";
import type { Purchase, PurchaseLot as Lot, ProfitData } from "@/components/acquisitions/types";

export function usePurchaseLots(purchaseId: string) {
  const supabase = supabaseBrowser();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [loadingProfit, setLoadingProfit] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  const loadPurchaseLots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/acquisitions/${purchaseId}/lots`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load purchase");
      }
      if (json.ok) {
        setPurchase(json.purchase);
        setLots(json.lots || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load purchase");
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  const loadProfitData = useCallback(async () => {
    setLoadingProfit(true);
    try {
      const res = await fetch(`/api/admin/acquisitions/${purchaseId}/profit`);
      const json = await res.json();
      if (json.ok && json.profit) {
        setProfitData(json.profit);
      }
    } catch (e: unknown) {
      logger.error("Failed to load profit data", e, undefined, { purchaseId });
    } finally {
      setLoadingProfit(false);
    }
  }, [purchaseId]);

  const loadDraftCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from("intake_lines")
        .select("*", { count: "exact", head: true })
        .eq("acquisition_id", purchaseId)
        .eq("status", "draft");

      if (!error && count !== null) {
        setDraftCount(count);
      }
    } catch (e: unknown) {
      logger.error("Failed to load draft count", e, undefined, { purchaseId });
    }
  }, [purchaseId, supabase]);

  useEffect(() => {
    if (purchaseId) {
      loadPurchaseLots();
      loadProfitData();
      loadDraftCount();
    }
  }, [purchaseId, loadPurchaseLots, loadProfitData, loadDraftCount]);

  return {
    purchase,
    lots,
    setLots,
    loading,
    error,
    profitData,
    loadingProfit,
    draftCount,
    loadPurchaseLots,
    loadProfitData,
    loadDraftCount,
  };
}
