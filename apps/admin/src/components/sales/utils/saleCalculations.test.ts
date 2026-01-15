import { describe, it, expect } from "vitest";
import { calculateTotals, calculateDealDiscount, autoAllocatePurchases } from "./saleCalculations";
import type { SaleItem, PromotionalDeal, ConsumableSelection } from "../types";

describe("Calculate Totals", () => {
  it("Calculates basic profit with no fees or shipping", () => {
    const items: SaleItem[] = [
      {
        lotId: "lot1",
        qty: 2,
        pricePence: 1000, // £10 each
        isFree: false,
        lot: null,
      },
    ];

    const result = calculateTotals(items, "0", "0", [], null, null);

    expect(result.revenue).toBe(20); // £20
    expect(result.feesCost).toBe(0);
    expect(result.shippingCost).toBe(0);
    expect(result.consumablesCost).toBe(0);
    expect(result.totalCosts).toBe(0);
    expect(result.netProfit).toBe(20);
    expect(result.margin).toBe(100);
  });

  it("Calculates profit with fees and shipping", () => {
    const items: SaleItem[] = [
      {
        lotId: "lot1",
        qty: 1,
        pricePence: 1000, // £10
        isFree: false,
        lot: null,
      },
    ];

    const result = calculateTotals(items, "2.50", "3.00", [], null, null);

    expect(result.revenue).toBe(10);
    expect(result.feesCost).toBe(2.5);
    expect(result.shippingCost).toBe(3);
    expect(result.totalCosts).toBe(5.5);
    expect(result.netProfit).toBe(4.5);
    expect(result.margin).toBe(45); // 4.5 / 10 * 100
  });

  it("Calculates profit with consumables", () => {
    const items: SaleItem[] = [
      {
        lotId: "lot1",
        qty: 1,
        pricePence: 1000,
        isFree: false,
        lot: null,
      },
    ];

    const consumables: ConsumableSelection[] = [
      {
        consumable_id: "cons1",
        consumable_name: "Bubble Wrap",
        qty: 2,
        unit_cost_pence: 500, // £5 per meter
      },
    ];

    const result = calculateTotals(items, "0", "0", consumables, null, null);

    expect(result.revenue).toBe(10);
    expect(result.consumablesCost).toBe(10); // 2 * 5
    expect(result.totalCosts).toBe(10);
    expect(result.netProfit).toBe(0);
    expect(result.margin).toBe(0);
  });

  it("Calculates profit with percentage discount", () => {
    const items: SaleItem[] = [
      {
        lotId: "lot1",
        qty: 2,
        pricePence: 1000, // £10 each = £20 total
        isFree: false,
        lot: null,
      },
    ];

    const dealDiscount = { type: "percentage_off", amount: 4000 }; // £40 (200% - invalid but tests logic)
    const result = calculateTotals(items, "0", "0", [], dealDiscount, null);

    expect(result.revenue).toBe(20);
    expect(result.discount).toBe(40);
    expect(result.revenueAfterDiscount).toBe(0); // Max 0
    expect(result.netProfit).toBe(0);
  });

  it("Calculates profit with free shipping deal", () => {
    const items: SaleItem[] = [
      {
        lotId: "lot1",
        qty: 1,
        pricePence: 1000,
        isFree: false,
        lot: null,
      },
    ];

    const dealDiscount = { type: "free_shipping", amount: 0 };
    const result = calculateTotals(items, "0", "5.00", [], dealDiscount, "deal1");

    expect(result.revenue).toBe(10);
    expect(result.shippingCost).toBe(0); // Free shipping
    expect(result.totalCosts).toBe(0);
    expect(result.netProfit).toBe(10);
  });

  it("Handles multiple items correctly", () => {
    const items: SaleItem[] = [
      {
        lotId: "lot1",
        qty: 3,
        pricePence: 1000, // £10 each = £30
        isFree: false,
        lot: null,
      },
      {
        lotId: "lot2",
        qty: 2,
        pricePence: 500, // £5 each = £10
        isFree: false,
        lot: null,
      },
    ];

    const result = calculateTotals(items, "1.50", "2.00", [], null, null);

    expect(result.revenue).toBe(40); // £30 + £10
    expect(result.feesCost).toBe(1.5);
    expect(result.shippingCost).toBe(2);
    expect(result.totalCosts).toBe(3.5);
    expect(result.netProfit).toBe(36.5);
    expect(result.margin).toBeCloseTo(91.25, 2);
  });
});

describe("Calculate Deal Discount", () => {
  it("Returns null for inactive deal", () => {
    const deal: PromotionalDeal = {
      id: "deal1",
      name: "Test Deal",
      description: null,
      is_active: false,
      deal_type: "percentage_off",
      discount_percent: 10,
      min_card_count: 5,
      max_card_count: null,
      discount_amount_pence: null,
      buy_quantity: null,
      get_quantity: null,
    };

    const items: SaleItem[] = [
      { lotId: "lot1", qty: 10, pricePence: 1000, isFree: false, lot: null },
    ];

    const result = calculateDealDiscount(items, deal);
    expect(result).toBeNull();
  });

  it("Returns null if minimum card count not met", () => {
    const deal: PromotionalDeal = {
      id: "deal1",
      name: "Test Deal",
      description: null,
      is_active: true,
      deal_type: "percentage_off",
      discount_percent: 10,
      min_card_count: 10,
      max_card_count: null,
      discount_amount_pence: null,
      buy_quantity: null,
      get_quantity: null,
    };

    const items: SaleItem[] = [
      { lotId: "lot1", qty: 5, pricePence: 1000, isFree: false, lot: null }, // Only 5 cards
    ];

    const result = calculateDealDiscount(items, deal);
    expect(result).toBeNull();
  });

  it("Calculates percentage discount correctly", () => {
    const deal: PromotionalDeal = {
      id: "deal1",
      name: "10% Off",
      description: null,
      is_active: true,
      deal_type: "percentage_off",
      discount_percent: 10,
      min_card_count: 1,
      max_card_count: null,
      discount_amount_pence: null,
      buy_quantity: null,
      get_quantity: null,
    };

    const items: SaleItem[] = [
      { lotId: "lot1", qty: 2, pricePence: 1000, isFree: false, lot: null }, // £20 total
    ];

    const result = calculateDealDiscount(items, deal);
    expect(result).toEqual({
      type: "percentage_off",
      amount: 200, // 10% of 2000 pence (2 × £10) = 200 pence
    });
  });

  it("Calculates fixed discount correctly", () => {
    const deal: PromotionalDeal = {
      id: "deal1",
      name: "£5 Off",
      description: null,
      is_active: true,
      deal_type: "fixed_off",
      discount_percent: null,
      min_card_count: 1,
      max_card_count: null,
      discount_amount_pence: 500, // £5
      buy_quantity: null,
      get_quantity: null,
    };

    const items: SaleItem[] = [
      { lotId: "lot1", qty: 1, pricePence: 1000, isFree: false, lot: null },
    ];

    const result = calculateDealDiscount(items, deal);
    expect(result).toEqual({
      type: "fixed_off",
      amount: 500,
    });
  });

  it("Calculates buy-x-get-y discount correctly (100% off)", () => {
    const deal: PromotionalDeal = {
      id: "deal1",
      name: "Buy 5 Get 1 Free",
      description: null,
      is_active: true,
      deal_type: "buy_x_get_y",
      discount_percent: 100,
      min_card_count: 5,
      max_card_count: null,
      discount_amount_pence: null,
      buy_quantity: 5,
      get_quantity: 1,
    };

    const items: SaleItem[] = [
      { lotId: "lot1", qty: 6, pricePence: 1000, isFree: false, lot: null }, // 6 cards at £10 each
    ];

    const result = calculateDealDiscount(items, deal);
    expect(result).toEqual({
      type: "buy_x_get_y",
      amount: 1000, // 1 free card = £10 = 1000 pence
    });
  });
});

describe("Auto Allocate Purchases", () => {
  it("Returns empty array when no purchases", () => {
    const item: SaleItem = {
      lotId: "lot1",
      qty: 5,
      pricePence: null,
      isFree: false,
      lot: {
        id: "lot1",
        condition: "NM",
        variation: "standard",
        quantity: 10,
        available_qty: 10,
        sold_qty: 0,
        list_price_pence: null,
        purchases: [],
        card: null,
      },
    };

    const result = autoAllocatePurchases(item);
    expect(result).toEqual([]);
  });

  it("Allocates to single purchase", () => {
    const item: SaleItem = {
      lotId: "lot1",
      qty: 5,
      pricePence: null,
      isFree: false,
      lot: {
        id: "lot1",
        condition: "NM",
        variation: "standard",
        quantity: 10,
        available_qty: 10,
        sold_qty: 0,
        list_price_pence: null,
        purchases: [
          {
            id: "purchase1",
            source_name: "Test Source",
            source_type: "test",
            purchased_at: new Date().toISOString(),
            status: "active",
            quantity: 10,
          },
        ],
        card: null,
      },
    };

    const result = autoAllocatePurchases(item);
    expect(result).toEqual([{ purchaseId: "purchase1", qty: 5 }]);
  });

  it("Allocates proportionally across multiple purchases", () => {
    const item: SaleItem = {
      lotId: "lot1",
      qty: 10,
      pricePence: null,
      isFree: false,
      lot: {
        id: "lot1",
        condition: "NM",
        variation: "standard",
        quantity: 40,
        available_qty: 40,
        sold_qty: 0,
        list_price_pence: null,
        purchases: [
          {
            id: "purchase1",
            source_name: "Test Source 1",
            source_type: "test",
            purchased_at: new Date().toISOString(),
            status: "active",
            quantity: 20, // 50% of total
          },
          {
            id: "purchase2",
            source_name: "Test Source 2",
            source_type: "test",
            purchased_at: new Date().toISOString(),
            status: "active",
            quantity: 15, // 37.5% of total
          },
          {
            id: "purchase3",
            source_name: "Test Source 3",
            source_type: "test",
            purchased_at: new Date().toISOString(),
            status: "active",
            quantity: 5, // 12.5% of total
          },
        ],
        card: null,
      },
    };

    const result = autoAllocatePurchases(item);

    // Should allocate proportionally
    expect(result.length).toBeGreaterThan(0);
    const totalAllocated = result.reduce((sum, alloc) => sum + alloc.qty, 0);
    expect(totalAllocated).toBe(10);

    // First purchase should get the most
    const purchase1Alloc = result.find((a) => a.purchaseId === "purchase1");
    expect(purchase1Alloc?.qty).toBeGreaterThanOrEqual(4);
  });

  it("Does not exceed available quantity", () => {
    const item: SaleItem = {
      lotId: "lot1",
      qty: 100, // More than available
      pricePence: null,
      isFree: false,
      lot: {
        id: "lot1",
        condition: "NM",
        variation: "standard",
        quantity: 35,
        available_qty: 35,
        sold_qty: 0,
        list_price_pence: null,
        purchases: [
          {
            id: "purchase1",
            source_name: "Test Source 1",
            source_type: "test",
            purchased_at: new Date().toISOString(),
            status: "active",
            quantity: 20,
          },
          {
            id: "purchase2",
            source_name: "Test Source 2",
            source_type: "test",
            purchased_at: new Date().toISOString(),
            status: "active",
            quantity: 15,
          },
        ],
        card: null,
      },
    };

    const result = autoAllocatePurchases(item);
    const totalAllocated = result.reduce((sum, alloc) => sum + alloc.qty, 0);
    expect(totalAllocated).toBeLessThanOrEqual(35); // Max available
  });
});
