"use client";

import Image from "next/image";

type Props = {
  url: string;
  name: string;
  x: number;
  y: number;
};

export function HoverImagePreview({ url, name, x, y }: Props) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translateY(-50%)",
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl border-2 border-black/20 p-3 max-w-xs">
        <div className="text-xs font-semibold mb-2 text-black/80">{name}</div>
        <div className="relative w-full aspect-auto min-h-[100px] rounded-lg overflow-hidden">
          <Image src={url} alt={name} fill className="object-contain rounded-lg" unoptimized />
        </div>
      </div>
    </div>
  );
}
