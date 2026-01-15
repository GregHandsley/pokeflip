"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import type { Condition } from "@/features/intake/types";
import PageHeader from "@/components/ui/PageHeader";
import LotDetailModal from "@/components/inventory/LotDetailModal";
import MarkSoldModal from "@/components/inventory/MarkSoldModal";
import SplitModal from "@/components/ui/SplitModal";
import MergeLotsModal from "@/components/inventory/MergeLotsModal";
import SalesFlowModal from "@/components/inbox/sales-flow/SalesFlowModal";
import type { InboxLot } from "@/components/inbox/sales-flow/types";
import { PurchaseInfo } from "@/components/acquisitions/PurchaseInfo";
import { PurchaseProfitSummary } from "@/components/acquisitions/PurchaseProfitSummary";
import type { PurchaseLot as Lot } from "@/components/acquisitions/types";
import { usePurchaseLots } from "./hooks/usePurchaseLots";
import { useLotSelection } from "./hooks/useLotSelection";
import { useLotActions } from "./hooks/useLotActions";
import { usePurchaseStatus } from "./hooks/usePurchaseStatus";
import { PurchaseLotsHeader } from "./components/PurchaseLotsHeader";
import { PurchaseLotsActions } from "./components/PurchaseLotsActions";
import { LotsBySetList } from "./components/LotsBySetList";
import { AddCardModal } from "./components/AddCardModal";
import { ClosePurchaseModal } from "./components/ClosePurchaseModal";
import { Toast } from "./components/Toast";

export default function PurchaseLotsPage() {
  const params = useParams();
  const purchaseId = params?.id as string;
  const [toast, setToast] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotToSplit, setLotToSplit] = useState<Lot | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [lotForSalesFlow, setLotForSalesFlow] = useState<InboxLot | null>(null);
  const [lotToMarkSold, setLotToMarkSold] = useState<Lot | null>(null);

  const {
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
  } = usePurchaseLots(purchaseId);

  const { selectedLots, toggleLotSelection, clearSelection, canMergeSelected } =
    useLotSelection(lots);

  const {
    committing,
    removingDraftId,
    updatingForSale,
    handleCommit,
    handleRemoveDraft,
    handleAddCard: handleAddCardAction,
    handleSplit: handleSplitAction,
    handleMerge: handleMergeAction,
    handleBulkUpdateForSale: handleBulkUpdateForSaleAction,
    handleLotClick: handleLotClickAction,
  } = useLotActions(purchaseId, loadPurchaseLots, loadProfitData, loadDraftCount, setToast);

  const {
    showMenu,
    setShowMenu,
    showCloseModal,
    setShowCloseModal,
    closing,
    handleCloseClick,
    handleReopenClick,
    confirmClose,
  } = usePurchaseStatus(purchaseId, loadPurchaseLots, loadProfitData, loadDraftCount, setToast);

  const handleAddCard = async (params: {
    setId: string;
    cardId: string;
    locale: string;
    condition: Condition;
    quantity: number;
    variation: string;
  }) => {
    await handleAddCardAction(params);
    setShowAddModal(false);
  };

  const handleSplit = async (
    splitQty: number,
    forSale: boolean,
    price: string | null,
    condition?: string
  ) => {
    if (!lotToSplit) return;
    await handleSplitAction(lotToSplit, splitQty, forSale, price, condition);
    setLotToSplit(null);
  };

  const handleMerge = async (targetLotId: string) => {
    const lotIds = Array.from(selectedLots);
    await handleMergeAction(lotIds, targetLotId);
    clearSelection();
    setShowMergeModal(false);
  };

  const handleBulkUpdateForSale = async (forSale: boolean) => {
    const lotIds = Array.from(selectedLots);
    await handleBulkUpdateForSaleAction(lotIds, forSale);
    clearSelection();
  };

  const handleLotClick = async (lot: Lot) => {
    const result = await handleLotClickAction(lot);
    if (!result) return;

    if (result.type === "detail") {
      setSelectedLot(result.lot as Lot);
    } else if (result.type === "salesFlow") {
      setLotForSalesFlow(result.lot as InboxLot);
    } else if (result.type === "markSold") {
      setLotToMarkSold(result.lot as Lot);
    }
  };

  const handleRefresh = async () => {
    await loadPurchaseLots();
    await loadProfitData();
    loadDraftCount();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Purchase Cards" />
        <div className="text-sm text-gray-600 py-8 text-center">Loading...</div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div>
        <PageHeader title="Purchase Cards" />
        <div className="text-sm text-red-600 py-8 text-center">{error || "Purchase not found"}</div>
      </div>
    );
  }

  return (
    <div>
      <PurchaseLotsHeader
        purchase={purchase}
        showMenu={showMenu}
        onShowMenu={setShowMenu}
        onAddCard={() => setShowAddModal(true)}
        onCloseClick={handleCloseClick}
        onReopenClick={handleReopenClick}
      />

      <Toast message={toast} />

      <PurchaseInfo purchase={purchase} lotCount={lots.length} />

      {profitData && <PurchaseProfitSummary profitData={profitData} loading={loadingProfit} />}

      <PurchaseLotsActions
        draftCount={draftCount}
        committing={committing}
        selectedLotsCount={selectedLots.size}
        canMergeSelected={canMergeSelected}
        updatingForSale={updatingForSale}
        onCommit={handleCommit}
        onMerge={() => setShowMergeModal(true)}
        onBulkUpdateForSale={handleBulkUpdateForSale}
        onClearSelection={clearSelection}
      />

      <LotsBySetList
        lots={lots}
        selectedLots={selectedLots}
        removingDraftId={removingDraftId}
        onToggleSelection={toggleLotSelection}
        onLotClick={handleLotClick}
        onRemoveDraft={handleRemoveDraft}
        onSplitClick={setLotToSplit}
      />

      <AddCardModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCard={handleAddCard}
      />

      {selectedLot && (
        <LotDetailModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
          onLotUpdated={async () => {
            setSelectedLot(null);
            await handleRefresh();
          }}
          onPhotoCountChanged={(lotId, newCount) => {
            setLots((prev) =>
              prev.map((lot) => (lot.id === lotId ? { ...lot, photo_count: newCount } : lot))
            );
          }}
        />
      )}

      {lotToSplit && (
        <SplitModal
          isOpen={!!lotToSplit}
          onClose={() => setLotToSplit(null)}
          onSplit={handleSplit}
          currentQuantity={lotToSplit.available_qty}
          currentForSale={lotToSplit.for_sale}
          currentPrice={lotToSplit.list_price_pence}
          currentCondition={lotToSplit.condition as Condition}
          title="Split Lot"
        />
      )}

      {showMergeModal && (
        <MergeLotsModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          onMerge={handleMerge}
          lots={lots.filter((lot) => selectedLots.has(lot.id))}
          cardName={lots.find((lot) => selectedLots.has(lot.id))?.card?.name || "Card"}
        />
      )}

      {lotForSalesFlow && (
        <SalesFlowModal
          lot={lotForSalesFlow}
          onClose={() => setLotForSalesFlow(null)}
          onUpdated={() => {
            setLotForSalesFlow(null);
            handleRefresh();
          }}
        />
      )}

      {lotToMarkSold && (
        <MarkSoldModal
          lot={lotToMarkSold}
          onClose={() => setLotToMarkSold(null)}
          onSaleCreated={() => {
            setLotToMarkSold(null);
            handleRefresh();
          }}
        />
      )}

      <ClosePurchaseModal
        isOpen={showCloseModal}
        closing={closing}
        purchase={purchase}
        onClose={() => setShowCloseModal(false)}
        onConfirm={confirmClose}
      />
    </div>
  );
}
