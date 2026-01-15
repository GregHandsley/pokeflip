import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function usePurchaseStatus(
  purchaseId: string,
  onRefresh: () => Promise<void>,
  onRefreshProfit: () => Promise<void>,
  onRefreshDraftCount: () => Promise<void>,
  setToast: (message: string | null) => void
) {
  const supabase = supabaseBrowser();
  const [showMenu, setShowMenu] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleCloseClick = () => {
    setShowMenu(false);
    setShowCloseModal(true);
  };

  const handleReopenClick = async () => {
    setShowMenu(false);
    setToast(null);
    const { error } = await supabase
      .from("acquisitions")
      // @ts-expect-error - Supabase types don't properly infer update payload types
      .update({ status: "open" })
      .eq("id", purchaseId);
    if (error) {
      setToast(error.message || "Failed to reopen purchase");
    } else {
      await onRefresh();
      await onRefreshProfit();
      await onRefreshDraftCount();
      setToast("Purchase reopened");
    }
  };

  const confirmClose = async () => {
    setClosing(true);
    setToast(null);
    const { error } = await supabase
      .from("acquisitions")
      // @ts-expect-error - Supabase types don't properly infer update payload types
      .update({ status: "closed" })
      .eq("id", purchaseId);
    if (error) {
      setToast(error.message || "Failed to close purchase");
      setClosing(false);
    } else {
      setShowCloseModal(false);
      setClosing(false);
      await onRefresh();
      await onRefreshProfit();
      await onRefreshDraftCount();
      setToast("Purchase closed");
    }
  };

  return {
    showMenu,
    setShowMenu,
    showCloseModal,
    setShowCloseModal,
    closing,
    handleCloseClick,
    handleReopenClick,
    confirmClose,
  };
}
