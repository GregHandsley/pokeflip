/**
 * Client-side cache for catalog data (sets and cards)
 * Provides simple in-memory caching with TTL to reduce API calls
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
};

class CatalogCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 60 * 60 * 1000; // 1 hour default

  /**
   * Get cached data or fetch and cache it
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    const entry = this.cache.get(key);

    // Check if cache entry exists and is still valid
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data as T;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Store in cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    return data;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    this.cache.forEach((entry) => {
      if (now - entry.timestamp < entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
    };
  }
}

// Singleton instance
export const catalogCache = new CatalogCache();

/**
 * Generate cache key for sets
 */
export function getSetsCacheKey(locale: string): string {
  return `sets:${locale}`;
}

/**
 * Generate cache key for cards
 */
export function getCardsCacheKey(setId: string, locale: string): string {
  return `cards:${setId}:${locale}`;
}
