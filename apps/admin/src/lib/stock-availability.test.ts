import { describe, it, expect } from "vitest";

/**
 * Test stock availability calculation logic
 * This mirrors the logic used in bundle and sales API endpoints
 */

function calculateAvailableQuantity(
  lotQuantity: number,
  soldQty: number,
  bundleReservedQty: number,
  currentBundleReservedQty: number = 0
): number {
  return lotQuantity - soldQty - bundleReservedQty - currentBundleReservedQty;
}

function validateStockForBundle(
  lotQuantity: number,
  soldQty: number,
  bundleReservedQty: number,
  bundleQuantity: number,
  cardsPerBundle: number
): { available: number; needed: number; isValid: boolean } {
  const availableQty = lotQuantity - soldQty - bundleReservedQty;
  const totalCardsNeeded = bundleQuantity * cardsPerBundle;

  return {
    available: availableQty,
    needed: totalCardsNeeded,
    isValid: availableQty >= totalCardsNeeded,
  };
}

describe("Stock Availability Calculation", () => {
  describe("Calculate Available Quantity", () => {
    it("Calculates available quantity correctly with no reservations", () => {
      expect(calculateAvailableQuantity(100, 20, 0, 0)).toBe(80);
    });

    it("Accounts for sold items", () => {
      expect(calculateAvailableQuantity(100, 50, 0, 0)).toBe(50);
    });

    it("Accounts for bundle reservations", () => {
      expect(calculateAvailableQuantity(100, 0, 30, 0)).toBe(70);
    });

    it("Accounts for current bundle reservations", () => {
      expect(calculateAvailableQuantity(100, 0, 0, 20)).toBe(80);
    });

    it("Accounts for all factors together", () => {
      // 100 total - 20 sold - 30 in other bundles - 10 in current bundle = 40 available
      expect(calculateAvailableQuantity(100, 20, 30, 10)).toBe(40);
    });

    it("Returns 0 when all items are accounted for", () => {
      expect(calculateAvailableQuantity(100, 50, 30, 20)).toBe(0);
    });

    it("Returns negative when over-allocated (should be caught by validation)", () => {
      expect(calculateAvailableQuantity(100, 50, 30, 30)).toBe(-10);
    });
  });

  describe("Validate Stock For Bundle", () => {
    it("Validates when enough stock available", () => {
      const result = validateStockForBundle(100, 20, 10, 2, 5);
      // 100 - 20 - 10 = 70 available
      // 2 bundles * 5 cards = 10 needed
      expect(result.available).toBe(70);
      expect(result.needed).toBe(10);
      expect(result.isValid).toBe(true);
    });

    it("Invalidates when insufficient stock", () => {
      const result = validateStockForBundle(100, 90, 5, 2, 5);
      // 100 - 90 - 5 = 5 available
      // 2 bundles * 5 cards = 10 needed
      expect(result.available).toBe(5);
      expect(result.needed).toBe(10);
      expect(result.isValid).toBe(false);
    });

    it("Validates when exactly enough stock", () => {
      const result = validateStockForBundle(100, 80, 10, 2, 5);
      // 100 - 80 - 10 = 10 available
      // 2 bundles * 5 cards = 10 needed
      expect(result.available).toBe(10);
      expect(result.needed).toBe(10);
      expect(result.isValid).toBe(true);
    });

    it("Accounts for bundle quantity correctly", () => {
      // Test with 5 bundles, 3 cards each = 15 cards needed
      const result = validateStockForBundle(100, 70, 10, 5, 3);
      // 100 - 70 - 10 = 20 available
      // 5 bundles * 3 cards = 15 needed
      expect(result.available).toBe(20);
      expect(result.needed).toBe(15);
      expect(result.isValid).toBe(true);
    });

    it("Handles zero sold and reserved", () => {
      const result = validateStockForBundle(100, 0, 0, 1, 10);
      expect(result.available).toBe(100);
      expect(result.needed).toBe(10);
      expect(result.isValid).toBe(true);
    });

    it("Handles edge case of zero available", () => {
      const result = validateStockForBundle(100, 50, 50, 1, 1);
      // 100 - 50 - 50 = 0 available
      // 1 bundle * 1 card = 1 needed
      expect(result.available).toBe(0);
      expect(result.needed).toBe(1);
      expect(result.isValid).toBe(false);
    });
  });

  describe("Bundle Quantity Validation Scenarios", () => {
    it("Validates single bundle with single card", () => {
      const result = validateStockForBundle(10, 0, 0, 1, 1);
      expect(result.isValid).toBe(true);
    });

    it("Validates multiple bundles with multiple cards", () => {
      const result = validateStockForBundle(100, 0, 0, 10, 5);
      // 10 bundles * 5 cards = 50 needed, 100 available
      expect(result.isValid).toBe(true);
    });

    it("Invalidates when bundle quantity exceeds available", () => {
      const result = validateStockForBundle(20, 0, 0, 5, 5);
      // 5 bundles * 5 cards = 25 needed, but only 20 available
      expect(result.isValid).toBe(false);
      expect(result.available).toBe(20);
      expect(result.needed).toBe(25);
    });

    it("Accounts for existing bundle reservations when creating new bundle", () => {
      // Creating a new bundle when 30 cards are already in other bundles
      const result = validateStockForBundle(100, 0, 30, 5, 10);
      // 100 - 0 - 30 = 70 available
      // 5 bundles * 10 cards = 50 needed
      expect(result.isValid).toBe(true);
    });

    it("Accounts for sold items when creating bundle", () => {
      // Creating bundle after some items have been sold
      const result = validateStockForBundle(100, 40, 10, 2, 20);
      // 100 - 40 - 10 = 50 available
      // 2 bundles * 20 cards = 40 needed
      expect(result.isValid).toBe(true);
    });

    it("Rejects when total needed exceeds available after accounting for reservations", () => {
      const result = validateStockForBundle(100, 40, 30, 2, 20);
      // 100 - 40 - 30 = 30 available
      // 2 bundles * 20 cards = 40 needed
      expect(result.isValid).toBe(false);
    });
  });
});
