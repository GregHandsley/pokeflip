import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual("@/lib/validation");
  return {
    ...actual,
    uuid: (val: string) => val,
    nonEmptyString: (val: string) => val,
    optional: (val: any, fn: any) => val === undefined ? undefined : fn(val, "field"),
    number: (val: number) => val,
    nonNegative: (val: number) => val,
    array: (val: any[]) => val,
    quantity: (val: number) => val,
  };
});

// TODO: Fix Supabase mocking to handle chained queries properly
describe.skip("POST /api/admin/bundles/[bundleId]/sell", () => {
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

  it("Sells a bundle successfully", async () => {
    // Mock bundle fetch
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "bundle1",
          status: "active",
          quantity: 3,
          bundle_items: [
            { id: "item1", lot_id: "lot1", quantity: 2 },
          ],
        },
        error: null,
      }),
    });

    // Mock lots fetch
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: "lot1", quantity: 10 }],
        error: null,
      }),
    });

    // Mock existing sales
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock active bundles (other bundles)
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
        data: [{ lot_id: "lot1", acquisition_id: "acq1", quantity: 10 }],
        error: null,
      }),
    });

    // Mock buyer lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "buyer1" },
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

    // Mock bundle quantity update
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "bundle1", quantity: 2 }], // Was 3, sold 1, now 2
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1/sell", {
      method: "POST",
      body: JSON.stringify({
        buyerHandle: "testbuyer",
        quantity: 1, // Sell 1 bundle
        feesPence: 100,
        shippingPence: 300,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.salesOrder).toBeDefined();
  });

  it("Rejects selling more bundles than available", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "bundle1",
          status: "active",
          quantity: 2, // Only 2 available
          bundle_items: [],
        },
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1/sell", {
      method: "POST",
      body: JSON.stringify({
        buyerHandle: "testbuyer",
        quantity: 5, // Trying to sell 5
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Only 2 bundle");
  });

  it("Rejects selling already sold bundle", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "bundle1",
          status: "sold",
          quantity: 0,
          bundle_items: [],
        },
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1/sell", {
      method: "POST",
      body: JSON.stringify({
        buyerHandle: "testbuyer",
        quantity: 1,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("already been sold");
  });
});

