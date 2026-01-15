"use client";

// import { useState } from "react";
import LotDetailModal from "./LotDetailModal";
import MarkSoldModal from "./MarkSoldModal";
import SalesFlowModal from "@/components/inbox/sales-flow/SalesFlowModal";
import SplitModal from "@/components/ui/SplitModal";
import MergeLotsModal from "./MergeLotsModal";
import CardAnalyticsPanel from "../analytics/CardAnalyticsPanel";
import BulkActions from "./BulkActions";
import LotList from "./LotList";
import SoldLotsSection from "./SoldLotsSection";
import DeleteLotModal from "./DeleteLotModal";
import { useCardLots } from "./hooks/useCardLots";
import type { CardLotsViewProps } from "./CardLotsView.types";
import type { Condition } from "@/features/intake/types";

export default function CardLotsView({ cardId, isExpanded, onLotsChanged }: CardLotsViewProps) {
  const {
    lots,
    loading,
    cardName,
    cardData,
    selectedLots,
    deletingLotId,
    showBulkDeleteConfirm,
    showSingleDeleteConfirm,
    lotToDelete,
    selectedLot,
    lotToMarkSold,
    soldLotsExpanded,
    activeLotSoldItemsExpanded,
    salesItemsByLot,
    loadingSalesItems,
    lotToSplit,
    showMergeModal,
    // merging,
    lotForSalesFlow,
    updatingForSale,
    setShowBulkDeleteConfirm,
    setShowSingleDeleteConfirm,
    setLotToDelete,
    setSelectedLot,
    setLotToMarkSold,
    setSoldLotsExpanded,
    setLotToSplit,
    setShowMergeModal,
    setLotForSalesFlow,
    loadLots,
    handleLotClick,
    toggleLotSelection,
    toggleSelectAll,
    toggleActiveLotSoldItems,
    handleDeleteLot,
    handleBulkDelete,
    handleMerge,
    handleBulkUpdateForSale,
    canMergeSelected,
  } = useCardLots(cardId, isExpanded);

  if (!isExpanded) return null;

  if (loading) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">Loading cards...</div>
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-500">No cards found</div>
      </div>
    );
  }

  const activeLots = lots.filter((lot) => lot.status !== "sold" && lot.status !== "archived");
  const soldLots = lots.filter((lot) => lot.status === "sold");

  return (
    <>
      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500">Card analytics</div>
            <div className="text-base font-semibold">{cardName || "Card"}</div>
          </div>
        </div>
        <CardAnalyticsPanel cardId={cardId} />
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <BulkActions
          lots={lots}
          selectedLots={selectedLots}
          canMerge={canMergeSelected()}
          updatingForSale={updatingForSale}
          deletingLotId={deletingLotId}
          onToggleSelectAll={toggleSelectAll}
          onBulkUpdateForSale={(forSale) => handleBulkUpdateForSale(forSale, onLotsChanged)}
          onMerge={() => setShowMergeModal(true)}
          onBulkDelete={() => setShowBulkDeleteConfirm(true)}
        />

        <LotList
          lots={activeLots}
          selectedLots={selectedLots}
          deletingLotId={deletingLotId}
          activeLotSoldItemsExpanded={activeLotSoldItemsExpanded}
          loadingSalesItems={loadingSalesItems}
          salesItemsByLot={salesItemsByLot}
          onSelect={toggleLotSelection}
          onLotClick={handleLotClick}
          onSplit={(lot, e) => {
            e.stopPropagation();
            setLotToSplit(lot);
          }}
          onDelete={(lot, e) => {
            e.stopPropagation();
            setLotToDelete(lot);
            setShowSingleDeleteConfirm(true);
          }}
          onToggleSoldItems={toggleActiveLotSoldItems}
        />

        <SoldLotsSection
          lots={soldLots}
          isExpanded={soldLotsExpanded}
          selectedLots={selectedLots}
          deletingLotId={deletingLotId}
          onToggleExpanded={() => setSoldLotsExpanded(!soldLotsExpanded)}
          onSelect={toggleLotSelection}
          onDelete={(lot, e) => {
            e.stopPropagation();
            setLotToDelete(lot);
            setShowSingleDeleteConfirm(true);
          }}
        />
      </div>

      <DeleteLotModal
        isOpen={showSingleDeleteConfirm}
        lot={lotToDelete}
        isBulk={false}
        onClose={() => {
          setShowSingleDeleteConfirm(false);
          setLotToDelete(null);
        }}
        onConfirm={() => lotToDelete && handleDeleteLot(lotToDelete.id, onLotsChanged)}
      />

      <DeleteLotModal
        isOpen={showBulkDeleteConfirm}
        lot={null}
        isBulk={true}
        selectedCount={selectedLots.size}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={() => handleBulkDelete(onLotsChanged)}
      />

      {selectedLot && cardData && (
        <LotDetailModal
          lot={{
            ...selectedLot,
            card_id: cardId,
            card: {
              id: cardData.id,
              number: cardData.number,
              name: cardData.name,
              rarity: cardData.rarity,
              image_url: cardData.image_url,
              set: cardData.set,
            },
          }}
          onClose={() => setSelectedLot(null)}
          onLotUpdated={() => {
            setSelectedLot(null);
            loadLots();
            onLotsChanged?.();
          }}
          // onPhotoCountChanged={(lotId, newCount) => {
          //   // Update the photo count for the specific lot in the local state
          //   // This is handled by the hook's setLots, but we need to access it
          //   // For now, we'll reload lots to ensure consistency
          //   loadLots();
          // }}
        />
      )}

      {lotToMarkSold && (
        <MarkSoldModal
          lot={lotToMarkSold}
          onClose={() => setLotToMarkSold(null)}
          onSaleCreated={() => {
            setLotToMarkSold(null);
            loadLots();
            onLotsChanged?.();
          }}
        />
      )}

      {lotToSplit && (
        <SplitModal
          isOpen={!!lotToSplit}
          onClose={() => setLotToSplit(null)}
          onSplit={async (splitQty, forSale, price, condition) => {
            try {
              const res = await fetch(`/api/admin/lots/${lotToSplit.id}/split`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  split_qty: splitQty,
                  for_sale: forSale,
                  list_price_pence: price,
                  condition: condition,
                }),
              });

              const json = await res.json();
              if (!res.ok) {
                throw new Error(json.error || "Failed to split card");
              }

              setLotToSplit(null);
              loadLots();
              onLotsChanged?.();
            } catch (e: unknown) {
              const error = e instanceof Error ? e : new Error(String(e));
              alert(error.message || "Failed to split card");
              throw e;
            }
          }}
          currentQuantity={lotToSplit.available_qty}
          currentForSale={lotToSplit.for_sale}
          currentPrice={lotToSplit.list_price_pence}
          currentCondition={lotToSplit.condition as Condition}
          title="Split Card"
        />
      )}

      {showMergeModal && (
        <MergeLotsModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          onMerge={(targetLotId) => handleMerge(targetLotId, onLotsChanged)}
          lots={lots.filter((lot) => selectedLots.has(lot.id))}
          cardName={cardName || "Card"}
        />
      )}

      {lotForSalesFlow && (
        <SalesFlowModal
          lot={lotForSalesFlow}
          onClose={() => setLotForSalesFlow(null)}
          onUpdated={() => {
            setLotForSalesFlow(null);
            loadLots();
            onLotsChanged?.();
          }}
        />
      )}
    </>
  );
}
