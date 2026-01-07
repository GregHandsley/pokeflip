import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import type {
  ListedLot,
  SaleItem,
  Buyer,
  Consumable,
  ConsumableSelection,
  PromotionalDeal,
  PurchaseAllocation,
} from "../types";

export function useRecordSale(isOpen: boolean) {
  const [listedLots, setListedLots] = useState<ListedLot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [buyerHandle, setBuyerHandle] = useState("");
  const [orderGroup, setOrderGroup] = useState("");
  const [fees, setFees] = useState<string>("");
  const [shipping, setShipping] = useState<string>("");
  const [existingBuyers, setExistingBuyers] = useState<Buyer[]>([]);
  const [buyerSuggestions, setBuyerSuggestions] = useState<Buyer[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [showBuyerSuggestions, setShowBuyerSuggestions] = useState(false);
  const [existingOrderGroups, setExistingOrderGroups] = useState<string[]>([]);
  const [showOrderGroupSuggestions, setShowOrderGroupSuggestions] = useState(false);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [selectedConsumables, setSelectedConsumables] = useState<ConsumableSelection[]>([]);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [autoGenerateOrderNumber, setAutoGenerateOrderNumber] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [promotionalDeals, setPromotionalDeals] = useState<PromotionalDeal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealDiscount, setDealDiscount] = useState<{ type: string; amount: number } | null>(null);

  const loadListedLots = useCallback(async () => {
    setLoadingLots(true);
    try {
      const res = await fetch("/api/admin/sales/listed-lots");
      const json = await res.json();
      if (json.ok) {
        setListedLots(json.lots || []);
      }
    } catch (e) {
      logger.error("Failed to load listed lots", e);
    } finally {
      setLoadingLots(false);
    }
  }, []);

  const loadBuyers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/buyers");
      const json = await res.json();
      if (json.ok) {
        setExistingBuyers(json.buyers || []);
      }
    } catch (e) {
      logger.error("Failed to load buyers", e);
    }
  }, []);

  const loadOrderGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok) {
        setExistingOrderGroups(json.orderGroups || []);
      }
    } catch (e) {
      logger.error("Failed to load order numbers", e);
    }
  }, []);

  const generateOrderNumber = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sales/order-groups");
      const json = await res.json();
      if (json.ok && json.orderGroups) {
        const existingGroups = json.orderGroups.filter((g: string) => /^(ORDER|ORD)-\d+$/.test(g));
        if (existingGroups.length > 0) {
          const numbers = existingGroups.map((g: string) => {
            const match = g.match(/(?:ORDER|ORD)-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          });
          const maxNum = Math.max(...numbers);
          const nextNum = maxNum + 1;
          setOrderGroup(`ORD-${nextNum.toString().padStart(4, "0")}`);
        } else {
          setOrderGroup("ORD-0001");
        }
      } else {
        setOrderGroup("ORD-0001");
      }
    } catch (e) {
      logger.error("Failed to generate order number", e);
      setOrderGroup("ORD-0001");
    }
  }, []);

  const loadConsumables = useCallback(async () => {
    setLoadingConsumables(true);
    try {
      const res = await fetch("/api/admin/consumables");
      const json = await res.json();
      if (json.ok) {
        setConsumables(json.consumables || []);
      }
    } catch (e) {
      logger.error("Failed to load consumables", e);
    } finally {
      setLoadingConsumables(false);
    }
  }, []);

  const loadPromotionalDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promotional-deals");
      const json = await res.json();
      if (json.ok) {
        setPromotionalDeals(json.deals || []);
      }
    } catch (e) {
      logger.error("Failed to load promotional deals", e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadListedLots();
      loadBuyers();
      loadOrderGroups();
      loadConsumables();
      loadPromotionalDeals();
      if (autoGenerateOrderNumber) {
        generateOrderNumber();
      }
    } else {
      setSaleItems([]);
      setBuyerHandle("");
      setOrderGroup("");
      setFees("");
      setShipping("");
      setSearchQuery("");
      setSelectedConsumables([]);
      setSelectedDealId(null);
      setDealDiscount(null);
    }
  }, [isOpen, loadListedLots, loadBuyers, loadOrderGroups, loadConsumables, loadPromotionalDeals, generateOrderNumber, autoGenerateOrderNumber]);

  return {
    // State
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
    // Functions
    generateOrderNumber,
  };
}

