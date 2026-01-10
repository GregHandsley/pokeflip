"use client";

import { useState, useMemo } from "react";

type OptimizedImageProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // For above-the-fold images
  fallback?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  quality?: "low" | "medium" | "high";
};

/**
 * Optimized image component with lazy loading, WebP support, and proper sizing
 * Uses native lazy loading for better performance
 */
export function OptimizedImage({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  fallback,
  onError,
  quality = "low",
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Convert quality to actual image size suffix
  const qualitySuffix = useMemo(() => {
    if (src.includes("/low.webp") || src.includes("/medium.webp") || src.includes("/high.webp")) {
      // If URL already has quality suffix, use as-is
      return "";
    }
    switch (quality) {
      case "low":
        return "/low.webp";
      case "medium":
        return "/medium.webp";
      case "high":
        return "/high.webp";
      default:
        return "/low.webp";
    }
  }, [src, quality]);

  // Construct optimized image URL
  const optimizedSrc = useMemo(() => {
    if (hasError && fallback) {
      return fallback;
    }
    // If src already ends with .webp or has a quality suffix, don't add another
    if (src.endsWith(".webp") || src.includes("/low.webp") || src.includes("/medium.webp") || src.includes("/high.webp")) {
      return src;
    }
    // Add quality suffix if URL pattern suggests it (e.g., API URLs)
    if (src && qualitySuffix) {
      return `${src}${qualitySuffix}`;
    }
    return src;
  }, [src, qualitySuffix, hasError, fallback]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded" aria-hidden="true" />
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        className={`${className} ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        width={width}
        height={height}
        onError={handleError}
        onLoad={handleLoad}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        }}
      />
    </div>
  );
}

