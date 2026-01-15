import { useState, useEffect } from "react";
import type { Lot } from "../LotDetailModal.types";

export function useLotStatus(lot: Lot, onLotUpdated?: () => void) {
  const [currentLot, setCurrentLot] = useState(lot);
  const [useApiImage, setUseApiImage] = useState(lot.use_api_image || false);
  const [updatingForSale, setUpdatingForSale] = useState(false);
  const [updatingApiImage, setUpdatingApiImage] = useState(false);

  useEffect(() => {
    setCurrentLot(lot);
    setUseApiImage(lot.use_api_image || false);
  }, [lot]);

  const updateForSaleStatus = async (newForSale: boolean) => {
    setUpdatingForSale(true);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/for-sale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          for_sale: newForSale,
          list_price_pence: newForSale && !currentLot.list_price_pence ? 0.99 : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update for_sale status");
      }

      // Fetch updated lot data from server to ensure status is in sync
      try {
        const lotRes = await fetch(`/api/admin/lots/${currentLot.id}`);
        const lotJson = await lotRes.json();
        if (lotJson.ok && lotJson.lot) {
          setCurrentLot({
            ...currentLot,
            ...lotJson.lot,
            card: currentLot.card, // Preserve card data
          });
        } else {
          // Fallback to optimistic update if fetch fails
          setCurrentLot((prev) => ({
            ...prev,
            for_sale: newForSale,
            list_price_pence: newForSale && !prev.list_price_pence ? 99 : prev.list_price_pence,
          }));
        }
      } catch {
        // Fallback to optimistic update if fetch fails
        setCurrentLot((prev) => ({
          ...prev,
          for_sale: newForSale,
          list_price_pence: newForSale && !prev.list_price_pence ? 99 : prev.list_price_pence,
        }));
      }
      onLotUpdated?.();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to update for sale status");
    } finally {
      setUpdatingForSale(false);
    }
  };

  const handleToggleForSale = async () => {
    await updateForSaleStatus(!currentLot.for_sale);
  };

  const handleToggleApiImage = async () => {
    const newValue = !useApiImage;
    setUpdatingApiImage(true);
    try {
      const res = await fetch(`/api/admin/lots/${currentLot.id}/use-api-image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_api_image: newValue }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update API image flag");
      }

      setUseApiImage(newValue);
      setCurrentLot((prev) => ({
        ...prev,
        use_api_image: newValue,
      }));
      onLotUpdated?.();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to update API image flag");
    } finally {
      setUpdatingApiImage(false);
    }
  };

  const updatePhotoCount = (newCount: number) => {
    setCurrentLot((prev) => ({
      ...prev,
      photo_count: newCount,
    }));
  };

  return {
    currentLot,
    useApiImage,
    updatingForSale,
    updatingApiImage,
    handleToggleForSale,
    handleToggleApiImage,
    updatePhotoCount,
  };
}
