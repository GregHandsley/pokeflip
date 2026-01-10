import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual("@/lib/validation");
  return {
    ...actual,
    nonEmptyString: (val: string) => val,
    array: (val: any[]) => val,
    uuid: (val: string) => val,
    quantity: (val: number) => val,
    pricePence: (val: number) => val,
    number: (val: number) => val,
    optional: (val: any, fn: any) => val === undefined ? undefined : fn(val, "field"),
    nonNegative: (val: number) => val,
  };
});

// TODO: Fix Supabase mocking to handle chained queries properly
describe.skip("POST /api/admin/sales/create", () => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseServer as any).mockReturnValue(mockSupabase);
  });

  it("creates a sale with multiple lots", async () => {
    // Mock buyer lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "buyer1", handle: "testbuyer" },
        error: null,
      }),
    });

    // Mock lots fetch
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "lot1", quantity: 10, for_sale: true },
          { id: "lot2", quantity: 5, for_sale: true },
        ],
        error: null,
      }),
    });

    // Mock sold items
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock active bundles
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock purchase history
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { lot_id: "lot1", acquisition_id: "acq1", quantity: 10 },
          { lot_id: "lot2", acquisition_id: "acq1", quantity: 5 },
        ],
        error: null,
      }),
    });

    // Mock sales order creation
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "order1" }],
        error: null,
      }),
    });

    // Mock sales items creation
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock purchase allocations
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock lot updates
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/sales/create", {
      method: "POST",
      body: JSON.stringify({
        buyerHandle: "testbuyer",
        platform: "ebay",
        lots: [
          { lotId: "lot1", qty: 2, pricePence: 1000 },
          { lotId: "lot2", qty: 1, pricePence: 500 },
        ],
        feesPence: 150,
        shippingPence: 300,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.salesOrder).toBeDefined();
  });

  it("rejects sale when lot not for sale", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "buyer1" },
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: "lot1", quantity: 10, for_sale: false }],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/sales/create", {
      method: "POST",
      body: JSON.stringify({
        buyerHandle: "testbuyer",
        lots: [{ lotId: "lot1", qty: 2, pricePence: 1000 }],
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("not for sale");
  });

  it("rejects sale when insufficient stock due to bundle reservations", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "buyer1" },
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: "lot1", quantity: 10, for_sale: true }],
        error: null,
      }),
    });

    // No sold items
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // 8 cards reserved in bundles
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "bundle1" }],
        error: null,
      }),
    });

    // Get bundle items showing 8 reserved
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ lot_id: "lot1", quantity: 4, bundle_id: "bundle1" }],
        error: null,
      }),
    });

    // Get bundle quantity (2 bundles × 4 cards = 8 reserved)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "bundle1", quantity: 2 }],
        error: null,
      }),
    });

    // Try to sell 5 cards, but only 2 available (10 - 8 reserved)
    const request = new Request("http://localhost:3000/api/admin/sales/create", {
      method: "POST",
      body: JSON.stringify({
        buyerHandle: "testbuyer",
        lots: [{ lotId: "lot1", qty: 5, pricePence: 1000 }],
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("insufficient") || expect(json.error).toContain("available");
  });
});

