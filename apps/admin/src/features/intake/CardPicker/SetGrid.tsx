"use client";

import { useState } from "react";
import Image from "next/image";
import type { TcgdxSet } from "./types";
import { DEFAULT_SET_IMAGE } from "@/lib/constants/images";

type Props = {
  sets: TcgdxSet[];
  loading: boolean;
  onSelectSet: (set: TcgdxSet) => void;
  locale?: string;
};

export function SetGrid({ sets, loading, onSelectSet, locale = "en" }: Props) {
  if (loading) {
    return <div className="text-center py-16 text-gray-600">Loading sets...</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {sets.map((set, index) => {
        const logoUrl = set.logo ? `${set.logo}.webp` : undefined;
        const symbolUrl = set.symbol ? `${set.symbol}.webp` : undefined;
        const imageUrl = logoUrl || symbolUrl;

        const isEnglish = locale === "en";
        const displayImageUrl = isEnglish && imageUrl ? imageUrl : DEFAULT_SET_IMAGE;

        return (
          <SetCard
            key={`${set.id}-${index}`}
            set={set}
            displayImageUrl={displayImageUrl}
            onSelectSet={onSelectSet}
          />
        );
      })}
    </div>
  );
}

function SetCard({
  set,
  displayImageUrl,
  onSelectSet,
}: {
  set: TcgdxSet;
  displayImageUrl: string;
  onSelectSet: (set: TcgdxSet) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState(displayImageUrl);

  const handleError = () => {
    if (!imageError) {
      setImageError(true);
      setImageSrc(DEFAULT_SET_IMAGE);
    }
  };

  return (
    <button
      onClick={() => onSelectSet(set)}
      className="border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all p-4 text-center"
    >
      <div className="relative w-full h-32 mb-3">
        <Image
          src={imageSrc}
          alt={set.name}
          fill
          className="object-contain"
          onError={handleError}
          unoptimized
        />
      </div>
      <div className="text-sm font-semibold line-clamp-2 min-h-10">{set.name}</div>
      <div className="text-xs text-gray-500 mt-1.5">{set.id}</div>
      {set.cardCount && (
        <div className="text-xs text-gray-400 mt-1">{set.cardCount.total} cards</div>
      )}
    </button>
  );
}
