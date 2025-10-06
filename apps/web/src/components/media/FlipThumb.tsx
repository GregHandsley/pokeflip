import React, { useState } from "react";
import AspectThumb from "./AspectThumb";

export default function FlipThumb({
  front,
  back,
  size = "list",
  className = "",
  onOpen, // (optional) if you want to wire a double-click to open a lightbox
}: {
  front?: any | null;
  back?: any | null;
  size?: "list" | "detail" | "zoom";
  className?: string;
  onOpen?: () => void;
}) {
  const f = front?.[size] ?? null;
  const b = back?.[size] ?? null;

  // Hover for pointer-precision devices, tap-to-toggle for touch
  const [hover, setHover] = useState(false);
  const [toggled, setToggled] = useState(false);

  const isTouch = typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)")?.matches;

  const flipped = (!!b && hover) || (!!b && toggled);

  return (
    <div
      className={"relative w-full aspect-[3/4] " + className}
      style={{ perspective: 800 }}
      onMouseEnter={() => !isTouch && setHover(true)}
      onMouseLeave={() => !isTouch && setHover(false)}
      onClick={() => {
        if (isTouch && b) setToggled((v) => !v);
      }}
      onDoubleClick={(e) => {
        if (onOpen) {
          e.stopPropagation();
          onOpen();
        }
      }}
      role="button"
      aria-label={flipped ? "Back" : "Front"}
      aria-pressed={flipped}
    >
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "none",
        }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden" }}
        >
          <AspectThumb srcs={f} alt="front" className="w-full" />
        </div>

        {/* Back face */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <AspectThumb srcs={b} alt="back" className="w-full" />
        </div>
      </div>

      {/* Small corner badge */}
      <div
        className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded
                   bg-black/50 text-white select-none pointer-events-none"
      >
        {flipped ? "Back" : "Front"}
      </div>
    </div>
  );
}