"use client";

import type { TcgdxCard } from "./types";
import { DEFAULT_CARD_BACK_IMAGE } from "@/lib/constants/images";

type Props = {
  cards: TcgdxCard[];
  loading: boolean;
  searchQuery: string;
  recentlyAdded: Set<string>;
  onCardClick: (card: TcgdxCard, imageUrl: string) => void;
  locale?: string;
};

export function CardGrid({ cards, loading, searchQuery, recentlyAdded, onCardClick, locale = "en" }: Props) {
  if (loading) {
    return <div className="text-center py-16 text-gray-600 flex-1">Loading cards...</div>;
  }

  const filteredCards = cards.filter((c) => {
    if (!searchQuery.trim()) return true;
    const needle = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(needle) ||
      c.localId?.toLowerCase().includes(needle) ||
      c.number?.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="overflow-y-auto flex-1 pr-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {filteredCards.map((card) => {
          const imageUrl = card.image ? `${card.image}/high.webp` : DEFAULT_CARD_BACK_IMAGE;
          const displayImageUrl = imageUrl || DEFAULT_CARD_BACK_IMAGE;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                onCardClick(card, displayImageUrl);
              }}
              className={`group rounded-xl border-2 bg-white p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                recentlyAdded.has(card.id)
                  ? "border-green-500 shadow-lg scale-105 bg-green-50"
                  : "border-gray-200 hover:border-blue-500 hover:shadow-lg"
              }`}
            >
              {locale === "en" && (
                <div className="text-sm font-semibold line-clamp-2 leading-tight break-words mb-2">{card.name}</div>
              )}
              <div className="aspect-[2.5/3.5] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center mb-3">
                <img
                  src={displayImageUrl}
                  alt={card.name || "Card"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback if default image also fails to load
                    (e.target as HTMLImageElement).src = DEFAULT_CARD_BACK_IMAGE;
                  }}
                />
              </div>
              {(card.localId || card.number) && (
                <div className={`font-bold ${locale === "en" ? "text-base text-gray-900 text-center" : "text-lg text-gray-900 text-center"}`}>
                  {card.localId || card.number}
                </div>
              )}
            </button>
          );
        })}
        {filteredCards.length === 0 && !loading && (
          <div className="col-span-full text-sm text-gray-600 text-center py-8">
            {searchQuery ? "No cards match your search" : "No cards in this set"}
          </div>
        )}
      </div>
    </div>
  );
}

