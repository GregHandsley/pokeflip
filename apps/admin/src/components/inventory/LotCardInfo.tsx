import Image from "next/image";
import type { Lot } from "./LotDetailModal.types";

interface Props {
  lot: Lot;
}

export default function LotCardInfo({ lot }: Props) {
  if (!lot.card) return null;

  return (
    <div className="flex items-start gap-6">
      {lot.card.image_url && (
        <div className="shrink-0 relative h-64 w-[183px] rounded-lg border-2 border-gray-300 shadow-md overflow-hidden">
          <Image
            src={`${lot.card.image_url}/high.webp`}
            alt={`${lot.card.name} card`}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium text-lg">
          <span className="text-gray-500 font-normal">#{lot.card.number}</span> {lot.card.name}
        </div>
        {lot.card.set && <div className="text-sm text-gray-600 mt-1">{lot.card.set.name}</div>}
        {lot.card.rarity && <div className="text-xs text-gray-500 mt-1">{lot.card.rarity}</div>}
      </div>
    </div>
  );
}
