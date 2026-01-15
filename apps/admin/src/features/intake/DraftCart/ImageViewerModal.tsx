"use client";

import Image from "next/image";

type Props = {
  url: string;
  name: string;
  onClose: () => void;
};

export function ImageViewerModal({ url, name, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-2xl w-full">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl"
          aria-label="Close"
        >
          ×
        </button>
        <div className="bg-white rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">{name}</h3>
          <div className="relative w-full aspect-auto min-h-[200px] rounded-lg overflow-hidden">
            <Image src={url} alt={name} fill className="object-contain rounded-lg" unoptimized />
          </div>
        </div>
      </div>
    </div>
  );
}
