"use client";

import type { TcgdxSet } from "./types";

type Props = {
  sets: TcgdxSet[];
  loading: boolean;
  onSelectSet: (set: TcgdxSet) => void;
};

export function SetGrid({ sets, loading, onSelectSet }: Props) {
  if (loading) {
    return <div className="text-center py-16 text-gray-600">Loading sets...</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {sets.map((set, index) => {
        const logoUrl = set.logo ? `${set.logo}.webp` : undefined;
        const symbolUrl = set.symbol ? `${set.symbol}.webp` : undefined;
        const imageUrl = logoUrl || symbolUrl;

        return (
          <button
            key={`${set.id}-${index}`}
            onClick={() => onSelectSet(set)}
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
  );
}

