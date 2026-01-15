"use client";

import React, { useSyncExternalStore } from "react";

/**
 * Component that blocks access on screens that are too small.
 * Shows a message to use a laptop instead.
 */
export default function MobileBlock({ children }: { children: React.ReactNode }) {
  // Minimum width for laptop screens (1024px = typical laptop minimum)
  const MIN_WIDTH = 1024;

  const width = useWindowWidth();
  const isMobile = width < MIN_WIDTH;

  // On the server (or before hydration), width will be 0 (from getServerSnapshot),
  // so we render nothing to avoid hydration mismatch.
  if (width === 0) return null;

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">Laptop Required</h1>

          <p className="text-gray-600 mb-2">
            This application is designed for use on a laptop or desktop computer.
          </p>
          <p className="text-gray-600 mb-6">
            Please access this application from a device with a screen width of at least {MIN_WIDTH}
            px.
          </p>

          <div className="text-sm text-gray-500">
            <p>
              Current screen width: <span className="font-mono font-semibold">{width}px</span>
            </p>
            <p className="mt-1">
              Required: <span className="font-mono font-semibold">{MIN_WIDTH}px</span> or wider
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function useWindowWidth(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      // Subscribe to resize events
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => window.innerWidth, // client snapshot
    () => 0 // server snapshot to avoid mismatch
  );
}
