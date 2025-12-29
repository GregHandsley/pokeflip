"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchAllSets, fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import { SUPPORTED_LANGUAGES } from "@/lib/tcgdx/constants";
import type { TcgdxSet, TcgdxCard } from "@/lib/tcgdx/types";

type Props = {
  onPickCard: (args: { setId: string; cardId: string; locale: string }) => void;
  locale?: string;
  onLocaleChange?: (locale: string) => void;
};

type View = "language" | "set" | "cards";

export function CardPicker({ onPickCard, locale: propLocale, onLocaleChange }: Props) {
  const [view, setView] = useState<View>(propLocale ? "set" : "language");
  const [locale, setLocale] = useState(propLocale || "en");
  const [sets, setSets] = useState<TcgdxSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<TcgdxSet | null>(null);
  const [cards, setCards] = useState<TcgdxCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Sync locale from prop
  useEffect(() => {
    if (propLocale && propLocale !== locale) {
      setLocale(propLocale);
      if (view === "language") {
        setView("set");
      }
    }
  }, [propLocale]);

  // Load sets when language is selected
  useEffect(() => {
    if (view === "set" && locale) {
      setLoadingSets(true);
      setError(null);
      fetchAllSets(locale)
        .then((fetchedSets) => {
          setSets(fetchedSets);
        })
        .catch((e: any) => {
          setError(`Failed to load sets: ${e.message}`);
        })
        .finally(() => {
          setLoadingSets(false);
        });
    }
  }, [view, locale]);

  // Load cards when set is selected
  useEffect(() => {
    if (view === "cards" && selectedSet) {
      setLoadingCards(true);
      setError(null);
      setSearchQuery(""); // Reset search when set changes
      fetchCardsForSet(selectedSet.id, locale)
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
  }, [view, selectedSet, locale]);

  const handleLanguageSelect = (langCode: string) => {
    setLocale(langCode);
    onLocaleChange?.(langCode);
    setView("set");
    setSelectedSet(null);
    setCards([]);
  };

  const handleSetSelect = (set: TcgdxSet) => {
    setSelectedSet(set);
    setView("cards");
  };

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const needle = searchQuery.toLowerCase();
    return cards.filter(
      (c) =>
        c.name?.toLowerCase().includes(needle) ||
        c.number?.toLowerCase().includes(needle)
    );
  }, [cards, searchQuery]);

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Card Browser</h2>
          <p className="mt-1.5 text-sm text-black/60">
            {view === "language" && "Select language"}
            {view === "set" && "Select a set"}
            {view === "cards" && `Cards in ${selectedSet?.name || "set"}`}
          </p>
        </div>
        {view !== "language" && (
          <button
            type="button"
            onClick={() => {
              if (view === "cards") {
                setView("set");
                setSelectedSet(null);
                setCards([]);
              } else if (view === "set") {
                setView("language");
                setSets([]);
              }
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

      {/* Language Selection */}
      {view === "language" && (
        <div className="overflow-y-auto flex-1 pr-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
              >
                <div className="font-semibold text-sm">{lang.name}</div>
                <div className="text-xs text-gray-600 mt-1">{lang.code}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Set Selection */}
      {view === "set" && (
        <div className="overflow-y-auto flex-1 pr-2">
          {loadingSets ? (
            <div className="text-center py-16 text-gray-600">Loading sets...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sets.map((set) => {
                const logoUrl = set.logo ? `${set.logo}.webp` : undefined;
                const symbolUrl = set.symbol ? `${set.symbol}.webp` : undefined;
                const imageUrl = logoUrl || symbolUrl;

                return (
                  <button
                    key={set.id}
                    onClick={() => handleSetSelect(set)}
                    className="border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all p-4 text-center"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={set.name}
                        className="w-full h-32 object-contain mb-3"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                        <span className="text-gray-400 text-sm">No Image</span>
                      </div>
                    )}
                    <div className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{set.name}</div>
                    <div className="text-xs text-gray-500 mt-1.5">{set.id}</div>
                    {set.cardCount && (
                      <div className="text-xs text-gray-400 mt-1">
                        {set.cardCount.total} cards
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Card Selection */}
      {view === "cards" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search */}
          <input
            className="w-full rounded-lg border border-black/10 px-4 py-2.5 mb-5 text-sm flex-shrink-0"
            placeholder="Search cards by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {loadingCards ? (
            <div className="text-center py-16 text-gray-600 flex-1">Loading cards...</div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {filteredCards.map((card) => {
                  const imageUrl = card.image ? `${card.image}/high.webp` : undefined;

                  return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={async () => {
                      setRecentlyAdded(new Set([...recentlyAdded, card.id]));
                      await onPickCard({ setId: selectedSet!.id, cardId: card.id, locale });
                      setTimeout(() => {
                        setRecentlyAdded(prev => {
                          const next = new Set(prev);
                          next.delete(card.id);
                          return next;
                        });
                      }, 1000);
                    }}
                    className={`group rounded-xl border-2 bg-white p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      recentlyAdded.has(card.id)
                        ? "border-green-500 shadow-lg scale-105 bg-green-50"
                        : "border-gray-200 hover:border-blue-500 hover:shadow-lg"
                    }`}
                  >
                      <div className="aspect-[2.5/3.5] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center mb-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={card.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="text-sm text-gray-400 p-3">No image</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{card.name}</div>
                      {card.number && (
                        <div className="text-xs text-gray-500 mt-1">#{card.number}</div>
                      )}
                    </button>
                  );
                })}
                {filteredCards.length === 0 && !loadingCards && (
                  <div className="col-span-full text-sm text-gray-600 text-center py-8">
                    {searchQuery ? "No cards match your search" : "No cards in this set"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

