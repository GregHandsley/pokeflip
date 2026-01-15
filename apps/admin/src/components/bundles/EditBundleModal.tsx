"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import { logger } from "@/lib/logger";

type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
  quantity: number;
};

type Lot = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
  quantity: number;
  available_qty: number;
  for_sale?: boolean;
  purchases?: Purchase[];
  card: {
    id: string;
    number: string;
    name: string;
    api_image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type BundleItem = {
  id: string;
  quantity: number;
  inventory_lots: {
    id: string;
    condition: string;
    variation: string | null;
    cards: {
      id: string;
      number: string;
      name: string;
      api_image_url: string | null;
      sets: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
};

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  quantity: number;
  status: string;
  bundle_items: BundleItem[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onBundleUpdated: () => void;
  bundle: Bundle;
};

export default function EditBundleModal({ isOpen, onClose, onBundleUpdated, bundle }: Props) {
  const [name, setName] = useState(bundle.name);
  const [description, setDescription] = useState(bundle.description || "");
  const [price, setPrice] = useState(penceToPounds(bundle.price_pence).toString());
  const [quantity, setQuantity] = useState((bundle.quantity || 1).toString());
  const [selectedLots, setSelectedLots] = useState<
    Map<string, { lot: Lot; quantity: number; bundleItemId?: string }>
  >(new Map());
  const [availableLots, setAvailableLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  const loadAvailableLots = useCallback(async (): Promise<Lot[]> => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sales/listed-lots");
      const json = await res.json();
      if (json.ok) {
        // Include lots that are already in this bundle (they should still show up)
        const lots = (json.lots || []).filter((lot: Lot) => {
          return lot.available_qty > 0 && lot.for_sale !== false;
        });

        // For lots already in bundle, we need to add the reserved quantity back to available
        // Reserved = bundle.quantity * bundle_item.quantity (total cards reserved)
        const bundleQuantity = bundle.quantity || 1;
        const lotsWithBundleQty = lots.map((lot: Lot) => {
          const bundleItem = bundle.bundle_items.find((item) => item.inventory_lots?.id === lot.id);
          if (bundleItem) {
            // Add back the reserved quantity: bundle.quantity * cards_per_bundle
            const reservedQty = bundleQuantity * bundleItem.quantity;
            return {
              ...lot,
              available_qty: lot.available_qty + reservedQty,
            };
          }
          return lot;
        });

        // Also add bundle items that might not be in the listed lots (edge case)
        bundle.bundle_items.forEach((item) => {
          if (
            item.inventory_lots &&
            !lotsWithBundleQty.some((l: Lot) => l.id === item.inventory_lots!.id)
          ) {
            const lot: Lot = {
              id: item.inventory_lots.id,
              card_id: item.inventory_lots.cards?.id || "",
              condition: item.inventory_lots.condition,
              variation: item.inventory_lots.variation || null,
              quantity: 0,
              available_qty: item.quantity, // At least what's in the bundle
              card: item.inventory_lots.cards
                ? {
                    id: item.inventory_lots.cards.id,
                    number: item.inventory_lots.cards.number,
                    name: item.inventory_lots.cards.name,
                    api_image_url: item.inventory_lots.cards.api_image_url,
                    set: item.inventory_lots.cards.sets,
                  }
                : null,
            };
            lotsWithBundleQty.push(lot);
          }
        });

        setAvailableLots(lotsWithBundleQty);
        setFilteredLots(lotsWithBundleQty);
        return lotsWithBundleQty;
      }
      return [];
    } catch (e) {
      logger.error("Failed to load lots for bundle editing", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [bundle]);

  // Initialize selected lots from bundle items
  useEffect(() => {
    if (isOpen && bundle) {
      setName(bundle.name);
      setDescription(bundle.description || "");
      setPrice(penceToPounds(bundle.price_pence).toString());
      setQuantity((bundle.quantity || 1).toString());

      // Load available lots first, then populate selected lots
      loadAvailableLots().then((loadedLots) => {
        const initialSelected = new Map<
          string,
          { lot: Lot; quantity: number; bundleItemId?: string }
        >();
        bundle.bundle_items.forEach((item) => {
          if (item.inventory_lots) {
            // Try to find the lot in loaded lots for full data
            const loadedLot = loadedLots.find((l) => l.id === item.inventory_lots!.id);
            const lot: Lot = loadedLot || {
              id: item.inventory_lots.id,
              card_id: item.inventory_lots.cards?.id || "",
              condition: item.inventory_lots.condition,
              variation: item.inventory_lots.variation,
              quantity: 0,
              available_qty: item.quantity, // At least what's in the bundle
              card: item.inventory_lots.cards
                ? {
                    id: item.inventory_lots.cards.id,
                    number: item.inventory_lots.cards.number,
                    name: item.inventory_lots.cards.name,
                    api_image_url: item.inventory_lots.cards.api_image_url,
                    set: item.inventory_lots.cards.sets,
                  }
                : null,
            };
            initialSelected.set(item.inventory_lots.id, {
              lot,
              quantity: item.quantity,
              bundleItemId: item.id,
            });
          }
        });
        setSelectedLots(initialSelected);
      });
    }
  }, [isOpen, bundle, loadAvailableLots]);

  // Validation function to check if a card would exceed stock
  const validateCardStock = useCallback(
    (lotId: string, cardsPerBundle: number): string | null => {
      const bundleQuantity = parseInt(quantity, 10) || 1;
      const lot = availableLots.find((l) => l.id === lotId);
      if (!lot) return "Lot not found";

      const totalCardsNeeded = bundleQuantity * cardsPerBundle;
      if (totalCardsNeeded > lot.available_qty) {
        const maxCardsPerBundle = Math.floor(lot.available_qty / bundleQuantity);
        return `Insufficient stock. Available: ${lot.available_qty}, Needed: ${totalCardsNeeded} (${cardsPerBundle} × ${bundleQuantity} bundles). Maximum ${maxCardsPerBundle} per bundle.`;
      }
      return null;
    },
    [quantity, availableLots]
  );

  // Validate all selected cards whenever quantity or bundle quantity changes
  useEffect(() => {
    const errors = new Map<string, string>();

    selectedLots.forEach((item, lotId) => {
      const error = validateCardStock(lotId, item.quantity);
      if (error) {
        errors.set(lotId, error);
      }
    });

    setValidationErrors(errors);
  }, [selectedLots, validateCardStock]);

  // Filter lots based on search query and stock availability
  useEffect(() => {
    const bundleQuantity = parseInt(quantity, 10) || 1;

    // First filter by stock availability - only show lots that have enough stock
    // For lots already selected, always show them (so user can see validation errors)
    // For other lots, only show if they have enough stock for at least 1 card per bundle
    const stockFiltered = availableLots.filter((lot) => {
      const isSelected = selectedLots.has(lot.id);
      if (isSelected) return true; // Always show selected lots for validation feedback
      const minCardsNeeded = bundleQuantity * 1; // At least 1 card per bundle
      return lot.available_qty >= minCardsNeeded;
    });

    // Then apply search filter if query exists
    if (!searchQuery.trim()) {
      setFilteredLots(stockFiltered);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = stockFiltered.filter((lot) => {
      const cardName = lot.card?.name?.toLowerCase() || "";
      const cardNumber = lot.card?.number?.toLowerCase() || "";
      const setName = lot.card?.set?.name?.toLowerCase() || "";
      const condition = lot.condition?.toLowerCase() || "";
      const variation = lot.variation?.toLowerCase() || "";

      const purchaseNames = (lot.purchases || [])
        .map((p) => p.source_name?.toLowerCase() || "")
        .join(" ");

      return (
        cardName.includes(query) ||
        cardNumber.includes(query) ||
        setName.includes(query) ||
        condition.includes(query) ||
        variation.includes(query) ||
        purchaseNames.includes(query)
      );
    });

    setFilteredLots(filtered);
  }, [searchQuery, availableLots, quantity, selectedLots]);

  const toggleLotSelection = (lot: Lot) => {
    const newSelected = new Map(selectedLots);
    if (newSelected.has(lot.id)) {
      newSelected.delete(lot.id);
    } else {
      // Check if this lot is already in the bundle
      const existingItem = bundle.bundle_items.find((item) => item.inventory_lots?.id === lot.id);
      newSelected.set(lot.id, {
        lot,
        quantity: existingItem?.quantity || 1,
        bundleItemId: existingItem?.id,
      });
    }
    setSelectedLots(newSelected);
  };

  const updateQuantity = (lotId: string, qty: number) => {
    const newSelected = new Map(selectedLots);
    const item = newSelected.get(lotId);
    if (item) {
      const bundleQuantity = parseInt(quantity, 10) || 1;
      const lot = availableLots.find((l) => l.id === lotId);
      if (!lot) return;

      // Calculate maximum cards per bundle based on available stock
      const maxCardsPerBundle = Math.floor(lot.available_qty / bundleQuantity);
      const finalQty = Math.min(Math.max(1, qty), maxCardsPerBundle);

      newSelected.set(lotId, { ...item, quantity: finalQty });
      setSelectedLots(newSelected);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter a bundle name");
      return;
    }

    if (!price.trim() || parseFloat(price) <= 0) {
      setError("Please enter a valid price");
      return;
    }

    if (selectedLots.size < 2) {
      setError("Please select at least 2 cards to create a bundle");
      return;
    }

    // Validate all cards before submitting
    const errors: string[] = [];
    selectedLots.forEach((item, lotId) => {
      const error = validateCardStock(lotId, item.quantity);
      if (error) {
        const lot = availableLots.find((l) => l.id === lotId);
        const cardName = lot?.card?.name || "Card";
        errors.push(`${cardName}: ${error}`);
      }
    });

    if (errors.length > 0) {
      setError(`Cannot save bundle. Stock validation failed:\n${errors.join("\n")}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Update bundle details first
      const bundleQuantity = parseInt(quantity, 10) || 1;
      if (bundleQuantity < 1) {
        setError("Bundle quantity must be at least 1");
        setSubmitting(false);
        return;
      }

      const updateRes = await fetch(`/api/admin/bundles/${bundle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          pricePence: poundsToPence(price),
          quantity: bundleQuantity,
        }),
      });

      const updateJson = await updateRes.json();
      if (!updateRes.ok) {
        throw new Error(updateJson.error || "Failed to update bundle");
      }

      // Update bundle items
      // First, identify items to add, update, and delete
      const newItemLotIds = new Set(selectedLots.keys());

      // Items to delete (in bundle but not selected)
      const itemsToDelete = bundle.bundle_items.filter(
        (item) => item.inventory_lots && !newItemLotIds.has(item.inventory_lots.id)
      );

      // Delete removed items
      for (const item of itemsToDelete) {
        if (item.id) {
          const deleteRes = await fetch(`/api/admin/bundles/${bundle.id}/items/${item.id}`, {
            method: "DELETE",
          });
          if (!deleteRes.ok) {
            const deleteJson = await deleteRes.json();
            throw new Error(deleteJson.error || "Failed to delete bundle item");
          }
        }
      }

      // Add or update items
      for (const [lotId, item] of selectedLots.entries()) {
        if (item.bundleItemId) {
          // Update existing item
          const updateItemRes = await fetch(
            `/api/admin/bundles/${bundle.id}/items/${item.bundleItemId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                quantity: item.quantity,
              }),
            }
          );
          if (!updateItemRes.ok) {
            const updateItemJson = await updateItemRes.json();
            throw new Error(updateItemJson.error || "Failed to update bundle item");
          }
        } else {
          // Add new item
          const addItemRes = await fetch(`/api/admin/bundles/${bundle.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lotId: lotId,
              quantity: item.quantity,
            }),
          });
          if (!addItemRes.ok) {
            const addItemJson = await addItemRes.json();
            throw new Error(addItemJson.error || "Failed to add bundle item");
          }
        }
      }

      onBundleUpdated();
      onClose();
    } catch (e: unknown) {
      logger.error("Failed to update bundle", e, undefined, {
        bundleId: bundle.id,
        name,
        pricePence: poundsToPence(price),
      });
      setError(e instanceof Error ? e.message : "Failed to update bundle");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCards = Array.from(selectedLots.values()).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Bundle"
      maxWidth="6xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || selectedLots.size < 2 || validationErrors.size > 0}
            title={
              selectedLots.size < 2
                ? "Please select at least 2 cards"
                : validationErrors.size > 0
                  ? "Please fix stock validation errors before saving"
                  : undefined
            }
          >
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded whitespace-pre-line">
            {error}
          </div>
        )}
        {validationErrors.size > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
            <div className="font-semibold mb-2">⚠️ Stock Validation Errors:</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {Array.from(validationErrors.entries()).map(([lotId, errorMsg]) => {
                const lot = availableLots.find((l) => l.id === lotId);
                const cardName = lot?.card?.name || "Unknown card";
                return (
                  <li key={lotId}>
                    <span className="font-medium">{cardName}:</span> {errorMsg}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Name *</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Starter Deck Bundle"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this bundle..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Price (£) *</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity Available *
          </label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            className="w-full"
          />
          <p className="mt-1 text-xs text-gray-500">
            How many of these bundles are available for sale
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Select Cards ({selectedLots.size} selected, {totalCards} total cards)
              {selectedLots.size < 2 && (
                <span className="ml-2 text-xs text-yellow-600">(Need at least 2 cards)</span>
              )}
            </label>
          </div>

          {/* Search Input */}
          <div className="mb-3">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by card name, number, set, condition, or purchase..."
              className="w-full"
            />
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 py-4">Loading available cards...</div>
          ) : filteredLots.length === 0 ? (
            <div className="text-sm text-gray-500 py-4">
              {searchQuery
                ? "No cards match your search"
                : availableLots.length === 0
                  ? "No available cards found"
                  : `No cards have enough stock for ${parseInt(quantity, 10) || 1} bundle(s). Try reducing the bundle quantity.`}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredLots.map((lot) => {
                const isSelected = selectedLots.has(lot.id);
                const selectedItem = selectedLots.get(lot.id);
                return (
                  <div
                    key={lot.id}
                    className={`p-3 border-b border-gray-200 last:border-b-0 ${
                      isSelected
                        ? validationErrors.has(lot.id)
                          ? "bg-red-50 border-red-200"
                          : "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLotSelection(lot)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      {lot.card?.api_image_url && (
                        <div className="relative h-12 w-auto rounded border border-gray-200 overflow-hidden">
                          <Image
                            src={`${lot.card.api_image_url}/low.webp`}
                            alt=""
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          #{lot.card?.number} {lot.card?.name}
                          {validationErrors.has(lot.id) && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                              Insufficient Stock
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {lot.card?.set?.name} • {lot.condition} • Available: {lot.available_qty}
                        </div>
                        {validationErrors.has(lot.id) && (
                          <div className="text-xs text-red-600 mt-1">
                            {validationErrors.get(lot.id)}
                          </div>
                        )}
                        {lot.purchases && lot.purchases.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            From purchase{lot.purchases.length > 1 ? "s" : ""}:{" "}
                            {lot.purchases.map((p, idx) => (
                              <span key={p.id}>
                                {idx > 0 && ", "}
                                <a
                                  href={`/admin/acquisitions/${p.id}/lots`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {p.source_name}
                                </a>
                                {p.quantity > 1 && (
                                  <span className="text-gray-400"> ({p.quantity})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            max={(() => {
                              const bundleQty = parseInt(quantity, 10) || 1;
                              const maxCardsPerBundle =
                                bundleQty > 0
                                  ? Math.floor((selectedItem?.lot.available_qty || 0) / bundleQty)
                                  : selectedItem?.lot.available_qty || 1;
                              return Math.max(1, maxCardsPerBundle);
                            })()}
                            value={selectedItem?.quantity || 1}
                            onChange={(e) =>
                              updateQuantity(lot.id, parseInt(e.target.value, 10) || 1)
                            }
                            className={`w-16 px-2 py-1 text-sm border rounded ${
                              validationErrors.has(lot.id)
                                ? "border-red-300 bg-red-50"
                                : "border-gray-300"
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
