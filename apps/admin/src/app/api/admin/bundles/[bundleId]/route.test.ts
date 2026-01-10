import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "./route";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual("@/lib/validation");
  return {
    ...actual,
    nonEmptyString: (val: string) => val,
    string: (val: string) => val,
    optional: (val: any, fn: any) => val === undefined ? undefined : fn(val, "field"),
    pricePence: (val: number) => val,
    quantity: (val: number) => val,
    bundleStatus: (val: string) => val,
    uuid: (val: string) => val,
  };
});

describe("PATCH /api/admin/bundles/[bundleId]", () => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseServer as any).mockReturnValue(mockSupabase);
  });

  it("Updates bundle name and description", async () => {
    // Mock bundle fetch
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "bundle1",
          status: "active",
          quantity: 1,
          bundle_items: [],
        },
        error: null,
      }),
    });

    // Mock update
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "bundle1", name: "Updated Name", description: "Updated description" }],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Updated Name",
        description: "Updated description",
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("Rejects updating sold bundle", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "bundle1",
          status: "sold",
          quantity: 1,
          bundle_items: [],
        },
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("sold");
  });

  it("Validates stock when increasing bundle quantity", async () => {
    // Mock bundle fetch
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "bundle1",
          status: "active",
          quantity: 1,
          bundle_items: [
            { id: "item1", lot_id: "lot1", quantity: 2 }, // 2 cards per bundle
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

    // Mock sold items
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ lot_id: "lot1", qty: 5 }],
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

    // Try to increase from 1 to 4 bundles
    // Current: 1 bundle × 2 cards = 2 reserved
    // New: 4 bundles × 2 cards = 8 needed
    // Available: 10 - 5 sold - 0 other bundles = 5 available
    // Need: 8 - 2 (current) = 6 additional
    // But only 5 available, so should fail

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1", {
      method: "PATCH",
      body: JSON.stringify({ quantity: 4 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Insufficient");
  });
});

// TODO: Fix Supabase mocking to handle chained queries properly
describe.skip("DELETE /api/admin/bundles/[bundleId]", () => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseServer as any).mockReturnValue(mockSupabase);
  });

  it("Deletes active bundle", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "bundle1", status: "active" },
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("Rejects deleting sold bundle", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "bundle1", status: "sold" },
        error: null,
      }),
    });

    const request = new Request("http://localhost:3000/api/admin/bundles/bundle1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ bundleId: "bundle1" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("sold");
  });
});

