"use client";

import type { TcgdxCard } from "./types";

type Props = {
  cards: TcgdxCard[];
  loading: boolean;
  searchQuery: string;
  recentlyAdded: Set<string>;
  onCardClick: (card: TcgdxCard, imageUrl: string) => void;
};

export function CardGrid({ cards, loading, searchQuery, recentlyAdded, onCardClick }: Props) {
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
          const imageUrl = card.image ? `${card.image}/high.webp` : undefined;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (imageUrl) {
                  onCardClick(card, imageUrl);
                }
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
              <div className="space-y-1.5">
                {(card.localId || card.number) && (
                  <div className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded inline-block">
                    #{card.localId || card.number}
                  </div>
                )}
                <div className="text-sm font-semibold line-clamp-2 leading-tight break-words">{card.name}</div>
              </div>
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

