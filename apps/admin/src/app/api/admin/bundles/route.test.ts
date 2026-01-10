import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { supabaseServer } from "@/lib/supabase/server";
import { ValidationErrorResponse } from "@/lib/validation";

// Mock Supabase
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual("@/lib/validation");
  return {
    ...actual,
    nonEmptyString: (val: string) => val,
    pricePence: (val: number) => val,
    nonEmptyArray: (val: any[]) => val,
    quantity: (val: number) => val,
    uuid: (val: string) => val,
    string: (val: string) => val,
    optional: (val: any, fn: any, name: string) => val === undefined ? undefined : fn(val, name),
  };
});

// TODO: Fix Supabase mocking to handle chained queries properly
// See INTEGRATION_TESTS_FIX_GUIDE.md for details
describe.skip("POST /api/admin/bundles", () => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseServer as any).mockReturnValue(mockSupabase);
  });

  it("creates a bundle with valid data", async () => {
    // Mock lot lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "lot1", quantity: 10, for_sale: true, status: "ready" },
        ],
        error: null,
      }),
    });

    // Mock sold items check
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock active bundles check
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Mock bundle creation
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "bundle1", name: "Test Bundle", quantity: 1 }],
        error: null,
      }),
    });

    // Mock bundle items creation
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: [{ id: "item1" }],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Bundle",
        description: "Test description",
        pricePence: 1000,
        quantity: 1,
        items: [
          { lotId: "lot1", quantity: 2 },
        ],
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.bundle).toBeDefined();
  });

  it("rejects bundle creation when lot not for sale", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "lot1", quantity: 10, for_sale: false, status: "ready" },
        ],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Bundle",
        pricePence: 1000,
        quantity: 1,
        items: [{ lotId: "lot1", quantity: 2 }],
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("not for sale");
  });

  it("rejects bundle creation when insufficient stock", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "lot1", quantity: 10, for_sale: true, status: "ready" },
        ],
        error: null,
      }),
    });

    // 5 already sold
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ lot_id: "lot1", qty: 5 }],
        error: null,
      }),
    });

    // No other bundle reservations
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Bundle",
        pricePence: 1000,
        quantity: 3, // 3 bundles
        items: [{ lotId: "lot1", quantity: 3 }], // 3 cards per bundle = 9 total needed
        // Only 5 available (10 - 5 sold), but need 9
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Insufficient quantity");
  });

  it("accounts for bundle reservations from other bundles", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "lot1", quantity: 20, for_sale: true, status: "ready" },
        ],
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

    // Other bundle has 10 reserved
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "bundle2" }],
        error: null,
      }),
    });

    // Get bundle items from other bundle
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ lot_id: "lot1", quantity: 5, bundle_id: "bundle2" }],
        error: null,
      }),
    });

    // Get bundle quantity for other bundle
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "bundle2", quantity: 2 }],
        error: null,
      }),
    });

    // Try to create bundle needing 15 (2 bundles × 8 cards), but only 10 available (20 - 10 reserved)
    const request = new Request("http://localhost:3000/api/admin/bundles", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Bundle",
        pricePence: 1000,
        quantity: 2,
        items: [{ lotId: "lot1", quantity: 8 }], // 2 × 8 = 16 needed, but only 10 available
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Insufficient quantity");
  });
});

