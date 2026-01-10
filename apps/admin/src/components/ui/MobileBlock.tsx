"use client";

import { useState, useEffect } from "react";

/**
 * Component that blocks access on screens that are too small.
 * Shows a message to use a laptop instead.
 */
export default function MobileBlock({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Minimum width for laptop screens (1024px = typical laptop minimum)
  const MIN_WIDTH = 1024;

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;
    
    setMounted(true);
    
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < MIN_WIDTH);
    };

    // Check on mount
    checkScreenSize();

    // Check on resize with debounce for performance
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkScreenSize, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Don't render anything during SSR to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Show mobile block message if screen is too small
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Laptop Required
          </h1>
          <p className="text-gray-600 mb-2">
            This application is designed for use on a laptop or desktop computer.
          </p>
          <p className="text-gray-600 mb-6">
            Please access this application from a device with a screen width of at least {MIN_WIDTH}px.
          </p>
          <div className="text-sm text-gray-500">
            <p>Current screen width: <span className="font-mono font-semibold">{typeof window !== 'undefined' ? window.innerWidth : 0}px</span></p>
            <p className="mt-1">Required: <span className="font-mono font-semibold">{MIN_WIDTH}px</span> or wider</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

