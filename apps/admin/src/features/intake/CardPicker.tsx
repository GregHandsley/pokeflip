"use client";

import { useState, useEffect } from "react";
import { fetchAllSets, fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import type { TcgdxSet, TcgdxCard, Condition } from "./CardPicker/types";
import { SetGrid } from "./CardPicker/SetGrid";
import { CardGrid } from "./CardPicker/CardGrid";
import { CardModal } from "./CardPicker/CardModal";

type Props = {
  onPickCard: (args: { setId: string; cardId: string; locale: string; condition: Condition; quantity: number }) => void;
};

type View = "set" | "cards";

export function CardPicker({ onPickCard }: Props) {
  const locale = "en"; // Always use English
  const [view, setView] = useState<View>("set");
  const [sets, setSets] = useState<TcgdxSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<TcgdxSet | null>(null);
  const [cards, setCards] = useState<TcgdxCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [modalCard, setModalCard] = useState<{ card: TcgdxCard; imageUrl: string } | null>(null);

  // Load sets on mount (always English)
  useEffect(() => {
    if (view === "set") {
      setLoadingSets(true);
      setError(null);
      fetchAllSets("en")
        .then((fetchedSets) => {
          // Deduplicate sets by ID (keep first occurrence)
          const uniqueSets = Array.from(
            new Map(fetchedSets.map(set => [set.id, set])).values()
          );
          setSets(uniqueSets);
        })
        .catch((e: any) => {
          setError(`Failed to load sets: ${e.message}`);
        })
        .finally(() => {
          setLoadingSets(false);
        });
    }
  }, [view]);

  // Load cards when set is selected (always English)
  useEffect(() => {
    if (view === "cards" && selectedSet) {
      setLoadingCards(true);
      setError(null);
      setSearchQuery(""); // Reset search when set changes
      fetchCardsForSet(selectedSet.id, "en")
        .then((fetchedCards) => {
          setCards(fetchedCards);
        })
        .catch((e: any) => {
          setError(`Failed to load cards: ${e.message}`);
          setCards([]);
        })
        .finally(() => {
          setLoadingCards(false);
        });
    }
  }, [view, selectedSet]);

  const handleSetSelect = (set: TcgdxSet) => {
    setSelectedSet(set);
    setView("cards");
  };

  const handleCardClick = (card: TcgdxCard, imageUrl: string) => {
    setModalCard({ card, imageUrl });
  };

  const handleCardAdded = (cardId: string) => {
    setRecentlyAdded(new Set([...recentlyAdded, cardId]));
    setTimeout(() => {
      setRecentlyAdded(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }, 1000);
  };

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Card Browser</h2>
          <p className="mt-1.5 text-sm text-black/60">
            {view === "set" && "Select a set"}
            {view === "cards" && `Cards in ${selectedSet?.name || "set"}`}
          </p>
        </div>
        {view === "cards" && (
          <button
            type="button"
            onClick={() => {
              setView("set");
              setSelectedSet(null);
              setCards([]);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Set Selection */}
      {view === "set" && (
        <div className="overflow-y-auto flex-1 pr-2">
          <SetGrid sets={sets} loading={loadingSets} onSelectSet={handleSetSelect} />
        </div>
      )}

      {/* Card Selection */}
      {view === "cards" && (
        <div className="flex flex-col flex-1 min-h-0">
          <input
            className="w-full rounded-lg border border-black/10 px-4 py-2.5 mb-5 text-sm flex-shrink-0"
            placeholder="Search cards by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <CardGrid
            cards={cards}
            loading={loadingCards}
            searchQuery={searchQuery}
            recentlyAdded={recentlyAdded}
            onCardClick={handleCardClick}
          />
        </div>
      )}

      {/* Modal for card selection */}
      {modalCard && selectedSet && (
        <CardModal
          card={modalCard.card}
          imageUrl={modalCard.imageUrl}
          selectedSetId={selectedSet.id}
          onAdd={onPickCard}
          onClose={() => setModalCard(null)}
          onCardAdded={handleCardAdded}
        />
      )}
    </section>
  );
}
