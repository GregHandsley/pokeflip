/**
 * Shared types for TCGdx API
 */

export type TcgdxSet = {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: {
    official?: number;
    total?: number;
  };
  releaseDate?: string;
  series?: {
    id: string;
    name: string;
  };
};

export type TcgdxCard = {
  id: string;
  name: string;
  image?: string;
  number?: string;
  localId?: string; // Card number from TCGdx API (e.g., "1", "2", "3")
  rarity?: string;
  set?: {
    id: string;
    name: string;
  };
  [key: string]: unknown; // Allow other TCGdx properties
};

/**
 * Simplified set type for dropdowns/selects
 */
export type TcgSet = {
  id: string;
  name: string;
  series?: string;
  releaseDate?: string;
};

/**
 * Simplified card type for forms
 */
export type TcgCard = {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  image?: string;
  images?: { small?: string; large?: string };
  set?: { id: string };
  [key: string]: unknown;
};
