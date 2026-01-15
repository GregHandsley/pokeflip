"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import SearchInput from "@/components/ui/SearchInput";
import CardLotsView from "./CardLotsView";
import Modal from "@/components/ui/Modal";

type CardInventoryData = {
  card_id: string;
  set_id: string;
  set_name: string;
  card_number: string;
  card_name: string;
  rarity: string | null;
  image_url: string | null;
  qty_on_hand: number;
  qty_for_sale: number;
  qty_sold: number;
};

// Group cards by set (reusing logic from DraftCart)
const groupCardsBySet = (cards: CardInventoryData[]) => {
  const grouped = new Map<string, CardInventoryData[]>();
  cards.forEach((card) => {
    const setId = card.set_id;
    if (!grouped.has(setId)) {
      grouped.set(setId, []);
    }
    grouped.get(setId)!.push(card);
  });
  return grouped;
};

export default function InventoryBySet() {
  const supabase = supabaseBrowser();
  const [cards, setCards] = useState<CardInventoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("v_card_inventory_totals")
        .select("*")
        .order("set_id", { ascending: true })
        .order("card_number", { ascending: true });

      if (fetchError) throw fetchError;

      // Filter out cards with no inventory (0 on hand and 0 sold)
      const cardsWithInventory = (data || []).filter(
        (card: CardInventoryData) => card.qty_on_hand > 0 || card.qty_sold > 0
      ) as CardInventoryData[];

      setCards(cardsWithInventory);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  // Filter cards by search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const query = searchQuery.toLowerCase();
    return cards.filter(
      (card) =>
        card.card_name.toLowerCase().includes(query) ||
        card.card_number.toLowerCase().includes(query) ||
        card.set_name.toLowerCase().includes(query)
    );
  }, [cards, searchQuery]);

  // Group filtered cards by set
  const cardsBySet = useMemo(() => {
    return groupCardsBySet(filteredCards);
  }, [filteredCards]);

  const toggleSet = (setId: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
      } else {
        next.add(setId);
      }
      return next;
    });
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;

    const { id: cardId } = cardToDelete;
    setDeletingCardId(cardId);
    try {
      const res = await fetch(`/api/admin/inventory/cards/${cardId}/delete`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete inventory");
      }

      // Reload the inventory
      await loadCards();
      setShowDeleteConfirm(false);
      setCardToDelete(null);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      alert(error.message || "Failed to delete inventory");
    } finally {
      setDeletingCardId(null);
    }
  };

  const initiateDeleteCard = (cardId: string, cardName: string) => {
    setCardToDelete({ id: cardId, name: cardName });
    setShowDeleteConfirm(true);
  };

  if (loading) {
    return <div className="text-sm text-gray-600 py-8 text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600 py-8 text-center">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="max-w-xl">
        <SearchInput
          placeholder="Search card name, number, or set…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Cards grouped by set */}
      {cardsBySet.size === 0 ? (
        <div className="text-sm text-gray-600 py-8 text-center">
          {searchQuery ? "No cards found." : "No inventory yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(cardsBySet.entries())
            .sort(([setIdA], [setIdB]) => {
              const setA = cardsBySet.get(setIdA)?.[0]?.set_name || "";
              const setB = cardsBySet.get(setIdB)?.[0]?.set_name || "";
              return setA.localeCompare(setB);
            })
            .map(([setId, setCards]) => {
              const set = setCards[0];
              const isExpanded = expandedSets.has(setId);
              const totalQty = setCards.reduce((sum, c) => sum + (c.qty_on_hand || 0), 0);
              const totalForSale = setCards.reduce((sum, c) => sum + (c.qty_for_sale || 0), 0);
              const totalSold = setCards.reduce((sum, c) => sum + (c.qty_sold || 0), 0);

              return (
                <div
                  key={setId}
                  className="border border-gray-200 rounded-lg overflow-hidden bg-white"
                >
                  {/* Set header */}
                  <button
                    onClick={() => toggleSet(setId)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{set.set_name}</div>
                        <div className="text-xs text-gray-500">
                          {setCards.length} card{setCards.length !== 1 ? "s" : ""} • Total:{" "}
                          {totalQty} • For sale: {totalForSale} • Sold: {totalSold}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Cards in set */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-200">
                      {setCards.map((card) => {
                        const isCardExpanded = expandedCards.has(card.card_id);
                        return (
                          <div key={card.card_id}>
                            <div className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                              <button
                                onClick={() => toggleCard(card.card_id)}
                                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                                title={isCardExpanded ? "Hide lots" : "Show lots"}
                              >
                                <svg
                                  className={`w-4 h-4 transition-transform ${
                                    isCardExpanded ? "rotate-90" : ""
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                              {card.image_url && (
                                <div className="relative h-16 w-[46px] rounded border border-gray-200 overflow-hidden shrink-0">
                                  <Image
                                    src={`${card.image_url}/low.webp`}
                                    alt={`${card.card_name} card`}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">
                                  <span className="text-gray-500 font-normal">
                                    #{card.card_number}
                                  </span>{" "}
                                  {card.card_name}
                                </div>
                                {card.rarity && (
                                  <div className="text-xs text-gray-500">{card.rarity}</div>
                                )}
                              </div>
                              <div className="text-right text-sm space-y-1">
                                <div>
                                  <span className="text-gray-600">On hand:</span>{" "}
                                  <span className="font-medium">{card.qty_on_hand}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">For sale:</span>{" "}
                                  <span className="font-medium text-green-600">
                                    {card.qty_for_sale}
                                  </span>
                                </div>
                                {card.qty_sold > 0 && (
                                  <div>
                                    <span className="text-gray-600">Sold:</span>{" "}
                                    <span className="font-medium text-gray-500">
                                      {card.qty_sold}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => initiateDeleteCard(card.card_id, card.card_name)}
                                disabled={deletingCardId === card.card_id}
                                className="ml-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete all inventory for this card"
                              >
                                {deletingCardId === card.card_id ? (
                                  <svg
                                    className="w-4 h-4 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                            {/* Lots view for this card */}
                            <CardLotsView
                              cardId={card.card_id}
                              isExpanded={isCardExpanded}
                              onLotsChanged={loadCards}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Delete card confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCardToDelete(null);
        }}
        title="Delete All Inventory"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setCardToDelete(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteCard}
              disabled={deletingCardId !== null}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingCardId ? "Deleting..." : "Delete All Inventory"}
            </button>
          </div>
        }
      >
        {cardToDelete && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Are you sure you want to delete all inventory for{" "}
              <strong>&quot;{cardToDelete.name}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This will permanently delete:
              </p>
              <ul className="mt-2 ml-4 list-disc text-sm text-red-700 space-y-1">
                <li>All lots for this card</li>
                <li>All associated photos</li>
                <li>All eBay listings</li>
                <li>All sales records</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
