import React, { useEffect } from "react";

export default function Lightbox({
  open, onClose, front, back,
}: {
  open: boolean; onClose: () => void;
  front?: { webp: string; jpeg: string } | null;
  back?: { webp: string; jpeg: string } | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex gap-4 max-w-[90vw]">
        {[front, back].filter(Boolean).map((srcs, idx) => (
          <picture key={idx} className="max-w-[42vw]">
            <source srcSet={srcs!.webp} type="image/webp" />
            <img
              src={srcs!.jpeg}
              className="max-h-[80vh] object-contain rounded-xl border border-white/20 shadow-2xl"
              alt={idx === 0 ? "front" : "back"}
              onClick={(e) => e.stopPropagation()}
            />
          </picture>
        ))}
      </div>
    </div>
  );
}