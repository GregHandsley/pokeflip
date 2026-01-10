import type { TcgdxSet, TcgdxCard } from "./types";

const BASE_URL = "https://api.tcgdex.net/v2";

/**
 * Construct a TCGdex card image URL with quality and extension
 * @param baseUrl Base image URL from API (without extension)
 * @param quality "high" (600x825) or "low" (245x337)
 * @param extension "webp" (recommended), "png", or "jpg"
 * @returns Full image URL
 */
export function getCardImageUrl(
  baseUrl: string | undefined,
  quality: "high" | "low" = "high",
  extension: "webp" | "png" | "jpg" = "webp"
): string | undefined {
  if (!baseUrl) return undefined;
  return `${baseUrl}/${quality}.${extension}`;
}

/**
 * Construct a TCGdex set symbol/logo URL with extension
 * @param baseUrl Base URL from API (without extension)
 * @param extension "webp" (recommended), "png", or "jpg"
 * @returns Full image URL
 */
export function getSetImageUrl(
  baseUrl: string | undefined,
  extension: "webp" | "png" | "jpg" = "webp"
): string | undefined {
  if (!baseUrl) return undefined;
  return `${baseUrl}.${extension}`;
}

/**
 * Fetch all sets from TCGdex API
 * Endpoint: GET https://api.tcgdex.net/v2/en/sets
 */
export async function fetchAllSets(locale: string = "en"): Promise<TcgdxSet[]> {
  // If running client-side, use our API route to avoid CORS
  if (typeof window !== "undefined") {
    const url = `/api/catalog/sets?locale=${encodeURIComponent(locale)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error || `API returned ${response.status}`);
    }

    const json = await response.json();
    
    if (!json.ok || !json.data) {
      throw new Error("Invalid API response: expected data array");
    }

    // API route returns full TcgdxSet[] format
    return json.data as TcgdxSet[];
  }

  // Server-side: call external API directly
  const url = `${BASE_URL}/${locale}/sets`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API returned ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  
  if (!Array.isArray(json)) {
    throw new Error("Invalid API response: expected array");
  }

  return json as TcgdxSet[];
}

/**
 * Fetch all cards for a specific set from TCGdex API
 * Endpoint: GET https://api.tcgdex.net/v2/en/sets/{setId}
 */
export async function fetchCardsForSet(setId: string, locale: string = "en"): Promise<TcgdxCard[]> {
  // If running client-side, use our API route to avoid CORS
  if (typeof window !== "undefined") {
    const url = `/api/catalog/cards?setId=${encodeURIComponent(setId)}&locale=${encodeURIComponent(locale)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error || `API returned ${response.status}`);
    }

    const json = await response.json();
    
    if (!json.ok || !json.data) {
      throw new Error("Invalid API response: expected data array");
    }

    return json.data as TcgdxCard[];
  }

  // Server-side: call external API directly
  const url = `${BASE_URL}/${locale}/sets/${setId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch cards: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  // TCGdx returns set object with cards array
  if (json && json.cards && Array.isArray(json.cards)) {
    return json.cards as TcgdxCard[];
  }

  // Fallback: if it's just an array
  if (Array.isArray(json)) {
    return json as TcgdxCard[];
  }

  throw new Error("Invalid API response: missing cards array");
}

/**
 * Fetch a single card by ID from TCGdex API
 * Endpoint: GET https://api.tcgdx.net/v2/{locale}/cards/{cardId}
 * Returns null if card doesn't exist in the requested locale (404)
 */
export async function fetchCardById(cardId: string, locale: string = "en"): Promise<TcgdxCard | null> {
  const url = `${BASE_URL}/${locale}/cards/${cardId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Card not found in this locale - this is normal, not an error
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Failed to fetch card: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json as TcgdxCard;
  } catch (error: any) {
    // Handle network errors or other issues
    if (error.message?.includes("404")) {
      return null; // Card doesn't exist in this locale
    }
    throw error; // Re-throw other errors
  }
}

