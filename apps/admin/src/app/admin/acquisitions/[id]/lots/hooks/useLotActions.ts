import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { insertDraftLine } from "@/features/intake/intakeInsert";
import { poundsToPence } from "@pokeflip/shared";
import type { Condition } from "@/features/intake/types";
import type { PurchaseLot as Lot } from "@/components/acquisitions/types";
import type { InboxLot } from "@/components/inbox/sales-flow/types";
import { convertLotToInboxLot } from "../utils/lotConversion";

type CommitAcquisitionResponse = {
  ok: boolean;
  message?: string;
};

export function useLotActions(
  purchaseId: string,
  onRefresh: () => Promise<void>,
  onRefreshProfit: () => Promise<void>,
  onRefreshDraftCount: () => Promise<void>,
  setToast: (message: string | null) => void
) {
  const supabase = supabaseBrowser();
  const [committing, setCommitting] = useState(false);
  const [removingDraftId, setRemovingDraftId] = useState<string | null>(null);
  const [updatingForSale, setUpdatingForSale] = useState(false);

  const handleCommit = async () => {
    setCommitting(true);
    setToast(null);
    try {
      // @ts-expect-error - RPC function not in generated types
      const { data, error } = await supabase.rpc("commit_acquisition", {
        p_acquisition_id: purchaseId,
      });

      if (error) {
        throw error;
      }

      setToast(
        (data as CommitAcquisitionResponse | null)?.message ?? "Cards committed to inventory"
      );
      await onRefresh();
      await onRefreshProfit();
      await onRefreshDraftCount();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to commit cards");
    } finally {
      setCommitting(false);
    }
  };

  const handleRemoveDraft = async (lotId: string) => {
    const intakeLineId = lotId.replace("draft-", "");

    setRemovingDraftId(lotId);
    setToast(null);
    try {
      const { error } = await supabase
        .from("intake_lines")
        .delete()
        .eq("id", intakeLineId)
        .eq("acquisition_id", purchaseId)
        .eq("status", "draft");

      if (error) {
        throw error;
      }

      setToast("Uncommitted card removed");
      await onRefresh();
      await onRefreshDraftCount();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to remove card");
    } finally {
      setRemovingDraftId(null);
    }
  };

  const handleAddCard = async ({
    setId,
    cardId,
    locale,
    condition,
    quantity,
    variation,
  }: {
    setId: string;
    cardId: string;
    locale: string;
    condition: Condition;
    quantity: number;
    variation: string;
  }) => {
    setToast(null);
    const { error } = await insertDraftLine({
      acquisitionId: purchaseId,
      setId,
      cardId,
      locale: locale || "en",
      quantity,
      defaults: {
        condition,
        variation,
        forSale: true,
        listPricePounds: "",
      },
    });

    if (error) {
      setToast(error.message || "Failed to add card");
    } else {
      setToast("Card added to draft cart. Click 'Commit to Inventory' to save.");
      await onRefreshDraftCount();
      await onRefresh();
    }
  };

  const handleSplit = async (
    lot: Lot,
    splitQty: number,
    forSale: boolean,
    price: string | null,
    condition?: string
  ) => {
    try {
      const res = await fetch(`/api/admin/lots/${lot.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_qty: splitQty,
          for_sale: forSale,
          list_price_pence: price ? poundsToPence(price) : null,
          condition: condition,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to split lot");
      }

      await onRefresh();
      await onRefreshProfit();
      setToast("Lot split successfully");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to split lot");
      throw e;
    }
  };

  const handleMerge = async (lotIds: string[], targetLotId: string) => {
    try {
      const res = await fetch("/api/admin/lots/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_ids: lotIds,
          target_lot_id: targetLotId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to merge lots");
      }

      await onRefresh();
      await onRefreshProfit();
      setToast("Lots merged successfully");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to merge lots");
      throw e;
    }
  };

  const handleBulkUpdateForSale = async (lotIds: string[], forSale: boolean) => {
    if (lotIds.length === 0) return;

    setUpdatingForSale(true);
    try {
      const results = await Promise.allSettled(
        lotIds.map((lotId) =>
          fetch(`/api/admin/lots/${lotId}/for-sale`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ for_sale: forSale }),
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setToast(`Failed to update ${failed} card(s). Please try again.`);
      } else {
        setToast(`Successfully updated ${lotIds.length} card(s)`);
      }

      await onRefresh();
      await onRefreshProfit();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to update for sale status");
    } finally {
      setUpdatingForSale(false);
    }
  };

  const handleLotClick = async (
    lot: Lot
  ): Promise<{ type: "detail" | "salesFlow" | "markSold"; lot: Lot | InboxLot } | null> => {
    // If marked as "not for sale", open Lot Detail modal to allow marking as for sale
    if (!lot.for_sale) {
      return { type: "detail", lot };
    }

    // If status is "listed", open Mark as Sold modal
    if (lot.status === "listed") {
      return { type: "markSold", lot };
    }

    // If status is "ready" (in inbox), open Sales Flow modal
    if (lot.status === "ready") {
      const inboxLot = await convertLotToInboxLot(lot);
      if (inboxLot) {
        return { type: "salesFlow", lot: inboxLot };
      } else {
        // Fallback to detail modal if conversion fails
        return { type: "detail", lot };
      }
    }

    // Otherwise, open detail modal (default behavior)
    return { type: "detail", lot };
  };

  return {
    committing,
    removingDraftId,
    updatingForSale,
    handleCommit,
    handleRemoveDraft,
    handleAddCard,
    handleSplit,
    handleMerge,
    handleBulkUpdateForSale,
    handleLotClick,
  };
}
