"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ErrorModal from "@/components/ui/ErrorModal";
import { useRecordSale } from "./hooks/useRecordSale";
import { useRecordSaleLogic } from "./hooks/useRecordSaleLogic";
import { autoAllocatePurchases } from "./utils/saleCalculations";
import CardSearch from "./components/CardSearch";
import SaleItemsList from "./components/SaleItemsList";
import BuyerOrderForm from "./components/BuyerOrderForm";
import ConsumablesSection from "./components/ConsumablesSection";
import PromotionalDealSelector from "./components/PromotionalDealSelector";
import SaleSummary from "./components/SaleSummary";
import type { Buyer } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaleCreated: () => void;
}

export default function RecordSaleModal({ isOpen, onClose, onSaleCreated }: Props) {
  const {
    listedLots,
    loadingLots,
    saleItems,
    setSaleItems,
    buyerHandle,
    setBuyerHandle,
    orderGroup,
    setOrderGroup,
    fees,
    setFees,
    shipping,
    setShipping,
    existingBuyers,
    buyerSuggestions,
    setBuyerSuggestions,
    selectedBuyer,
    setSelectedBuyer,
    showBuyerSuggestions,
    setShowBuyerSuggestions,
    existingOrderGroups,
    showOrderGroupSuggestions,
    setShowOrderGroupSuggestions,
    consumables,
    selectedConsumables,
    setSelectedConsumables,
    loadingConsumables,
    autoGenerateOrderNumber,
    setAutoGenerateOrderNumber,
    searchQuery,
    setSearchQuery,
    promotionalDeals,
    selectedDealId,
    setSelectedDealId,
    dealDiscount,
    setDealDiscount,
    generateOrderNumber,
  } = useRecordSale(isOpen);

  const {
    errorModal,
    setErrorModal,
    addCardToSale,
    removeCardFromSale,
    updateSaleItem,
    handleAddConsumable,
    handleRemoveConsumable,
    handleUpdateConsumable,
    handleDealChange,
  } = useRecordSaleLogic(
    saleItems,
    setSaleItems,
    consumables,
    selectedConsumables,
    setSelectedConsumables,
    promotionalDeals,
    selectedDealId,
    setDealDiscount
  );

  const [submitting, setSubmitting] = useState(false);

  const handleBuyerHandleChange = (value: string) => {
    setBuyerHandle(value);
    setSelectedBuyer(null);

    if (value.length > 0) {
      const filtered = existingBuyers.filter((b) =>
        b.handle.toLowerCase().includes(value.toLowerCase())
      );
      setBuyerSuggestions(filtered.slice(0, 5));
      setShowBuyerSuggestions(true);
    } else {
      setShowBuyerSuggestions(false);
    }
  };

  const handleSelectBuyer = (buyer: Buyer) => {
    setBuyerHandle(buyer.handle);
    setSelectedBuyer(buyer);
    setShowBuyerSuggestions(false);
  };

  const handleOrderGroupChange = (value: string) => {
    setOrderGroup(value);

    if (value.length > 0) {
      const filtered = existingOrderGroups.filter((g) =>
        g.toLowerCase().includes(value.toLowerCase())
      );
      setShowOrderGroupSuggestions(filtered.length > 0);
    } else {
      setShowOrderGroupSuggestions(false);
    }
  };

  const handleAutoGenerateToggle = (checked: boolean) => {
    setAutoGenerateOrderNumber(checked);
    if (checked) {
      generateOrderNumber();
    } else {
      setOrderGroup("");
    }
  };

  const handleSubmit = async () => {
    if (saleItems.length === 0) {
      setErrorModal({ isOpen: true, message: "Please add at least one card to the sale" });
      return;
    }

    for (const item of saleItems) {
      if (!item.isFree && (!item.pricePence || item.pricePence <= 0)) {
        setErrorModal({
          isOpen: true,
          message: "Please enter a price for all cards or mark them as free",
        });
        return;
      }
      if (item.qty <= 0) {
        setErrorModal({
          isOpen: true,
          message: "Please enter a valid quantity for all cards",
        });
        return;
      }
    }

    if (!buyerHandle.trim()) {
      setErrorModal({ isOpen: true, message: "Please enter a buyer handle" });
      return;
    }

    if (orderGroup.trim()) {
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok && json.orderGroups) {
        const existing = json.orderGroups.find((g: string) => g === orderGroup.trim());
        if (existing) {
          setErrorModal({
            isOpen: true,
            message: `Order number "${orderGroup.trim()}" already exists. Please use a different number.`,
          });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/sales/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lots: saleItems.map((item) => {
            const purchases = item.lot?.purchases || [];
            let purchaseAllocations: Array<{ purchaseId: string; qty: number }> = [];

            if (purchases.length === 1) {
              purchaseAllocations = [{ purchaseId: purchases[0].id, qty: item.qty }];
            } else if (purchases.length > 1) {
              if (
                item.manualAllocation &&
                item.purchaseAllocations &&
                item.purchaseAllocations.length > 0
              ) {
                purchaseAllocations = item.purchaseAllocations;
              } else {
                purchaseAllocations = autoAllocatePurchases(item);
              }
            }

            return {
              lotId: item.lotId,
              qty: item.qty,
              pricePence: item.pricePence,
              purchaseAllocations: purchaseAllocations.length > 0 ? purchaseAllocations : null,
            };
          }),
          buyerHandle: buyerHandle.trim(),
          orderGroup: orderGroup.trim() || null,
          feesPence: fees ? Math.round(parseFloat(fees) * 100) : null,
          shippingPence: shipping ? Math.round(parseFloat(shipping) * 100) : null,
          discountPence: dealDiscount && dealDiscount.amount > 0 ? Math.round(dealDiscount.amount) : null,
          consumables: selectedConsumables
            .filter((c) => c.consumable_id && c.qty > 0)
            .map((c) => ({
              consumable_id: c.consumable_id,
              qty: c.qty,
            })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create sale");
      }

      onSaleCreated();
      onClose();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to create sale" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Record Sale"
        maxWidth="6xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || saleItems.length === 0}
            >
              {submitting ? "Creating Sale..." : "Record Sale"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <CardSearch
            listedLots={listedLots}
            loadingLots={loadingLots}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            saleItems={saleItems}
            onAddCard={addCardToSale}
          />

          <SaleItemsList
            saleItems={saleItems}
            onUpdateItem={updateSaleItem}
            onRemoveItem={removeCardFromSale}
            onError={(msg) => setErrorModal({ isOpen: true, message: msg })}
          />

          <PromotionalDealSelector
            promotionalDeals={promotionalDeals}
            selectedDealId={selectedDealId}
            saleItems={saleItems}
            dealDiscount={dealDiscount}
            onDealChange={(dealId) => handleDealChange(dealId, setSelectedDealId)}
          />

          <BuyerOrderForm
            buyerHandle={buyerHandle}
            onBuyerHandleChange={handleBuyerHandleChange}
            selectedBuyer={selectedBuyer}
            buyerSuggestions={buyerSuggestions}
            showBuyerSuggestions={showBuyerSuggestions}
            onSelectBuyer={handleSelectBuyer}
            orderGroup={orderGroup}
            onOrderGroupChange={handleOrderGroupChange}
            autoGenerateOrderNumber={autoGenerateOrderNumber}
            onAutoGenerateToggle={handleAutoGenerateToggle}
            fees={fees}
            onFeesChange={setFees}
            shipping={shipping}
            onShippingChange={setShipping}
          />

          <ConsumablesSection
            consumables={consumables}
            selectedConsumables={selectedConsumables}
            loadingConsumables={loadingConsumables}
            onAddConsumable={handleAddConsumable}
            onRemoveConsumable={handleRemoveConsumable}
            onUpdateConsumable={handleUpdateConsumable}
          />

          <SaleSummary
            saleItems={saleItems}
            fees={fees}
            shipping={shipping}
            selectedConsumables={selectedConsumables}
            dealDiscount={dealDiscount}
            selectedDealId={selectedDealId}
          />
        </div>
      </Modal>

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        message={errorModal.message}
      />
    </>
  );
}
