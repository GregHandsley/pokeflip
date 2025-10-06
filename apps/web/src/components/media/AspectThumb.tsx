import React, { useEffect, useRef, useState } from "react";

type Sources = { webp: string; jpeg: string };

export default function AspectThumb({
  srcs,              // required: { webp, jpeg } at chosen size
  alt,
  className = "",
  eager = false,     // eager for detail, lazy for lists
}: { srcs?: Sources | null; alt: string; className?: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imgRef.current || !srcs) return;
    const img = imgRef.current;
    if (img.complete) setLoaded(true);
  }, [srcs]);

  return (
    <div
      className={
        "aspect-[3/4] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] " +
        "overflow-hidden relative " + className
      }
    >
      {/* shimmer skeleton */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-[rgb(var(--surface-alt))]" />
      )}

      {/* blur-up tiny background (optional) */}
      {/* You can add a tiny base64 blur here if you decide to send one later */}

      {srcs && (
        <picture>
          <source srcSet={srcs.webp} type="image/webp" />
          <img
            ref={imgRef}
            src={srcs.jpeg}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            className={
              "absolute inset-0 w-full h-full object-contain transition-opacity duration-200 " +
              (loaded ? "opacity-100" : "opacity-0")
            }
            onLoad={() => setLoaded(true)}
            draggable={false}
          />
        </picture>
      )}
    </div>
  );
}