/**
 * Helper utilities for mocking Supabase in tests
 *
 * This provides a factory function to create properly chained Supabase mocks
 * that handle the complex query chaining (from().select().eq().in()...)
 */

import { vi } from "vitest";

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
};

type QueryConditions = Record<string, unknown>;

type ChainableBuilder<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (columns?: string) => ChainableBuilder<T>;
  insert: (values: unknown) => ChainableBuilder<T>;
  update: (values: unknown) => ChainableBuilder<T>;
  delete: () => ChainableBuilder<T>;
  eq: (column: string, value: unknown) => ChainableBuilder<T>;
  neq: (column: string, value: unknown) => ChainableBuilder<T>;
  in: (column: string, values: unknown[]) => ChainableBuilder<T>;
  limit: (count: number) => ChainableBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => ChainableBuilder<T>;
  single: () => Promise<SupabaseResult<T>>;
  catch: <R = never>(
    onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null
  ) => Promise<SupabaseResult<T> | R>;
};

/**
 * Creates a mock Supabase client that properly handles chained queries
 * Usage:
 *   const mockSupabase = createSupabaseMock();
 *   mockSupabase.mockQuery("inventory_lots", {
 *     select: { id: true, quantity: true },
 *     where: { id: { in: ["lot1"] } },
 *     result: { data: [{ id: "lot1", quantity: 10 }], error: null }
 *   });
 */
export function createSupabaseMock() {
  const queries: Array<{
    table: string;
    conditions: QueryConditions;
    result: SupabaseResult;
  }> = [];

  // Create a chainable mock builder
  function createChainableQueryBuilder<T = unknown>(
    mockResult: SupabaseResult<T>
  ): ChainableBuilder<T> {
    const builder = {} as ChainableBuilder<T>;

    builder.select = vi.fn().mockReturnValue(builder);
    builder.insert = vi.fn().mockReturnValue(builder);
    builder.update = vi.fn().mockReturnValue(builder);
    builder.delete = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.neq = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.limit = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.single = vi.fn().mockResolvedValue(mockResult);
    // For queries that don't end in single(), resolve the promise directly

    // Make the builder itself thenable (so await builder works)
    const promise = Promise.resolve(mockResult);
    builder.then = promise.then.bind(promise);
    builder.catch = promise.catch.bind(promise);

    return builder;
  }

  const mockSupabase = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: vi.fn((_table: string) => {
      // Find matching query result
      // For now, return a chainable builder that eventually resolves
      // The actual implementation would need to match queries more intelligently
      return createChainableQueryBuilder({ data: null, error: null });
    }),

    // Helper method to register expected queries
    mockQuery: (
      table: string,
      config: {
        select?: Record<string, boolean>;
        where?: QueryConditions;
        result: SupabaseResult;
      }
    ) => {
      queries.push({
        table,
        conditions: config.where || {},
        result: config.result,
      });
    },
  };

  return mockSupabase;
}

/**
 * Simpler approach: Create a mock that stores expected responses in order
 * and returns them sequentially for each .from() call
 */
export function createSequentialSupabaseMock<T = unknown>(responses: Array<SupabaseResult<T>>) {
  let callIndex = 0;

  function createChainableBuilder(result: SupabaseResult<T>): ChainableBuilder<T> {
    const builder = {} as ChainableBuilder<T>;

    // All chain methods return the builder
    ["select", "insert", "update", "delete", "eq", "neq", "in", "limit", "order"].forEach(
      (method) => {
        (builder as unknown as Record<string, unknown>)[method] = vi.fn().mockReturnValue(builder);
      }
    );

    // single() resolves with the result
    builder.single = vi.fn().mockResolvedValue(result);

    // The builder itself can be awaited (returns a promise)
    const promise = Promise.resolve(result);
    builder.then = promise.then.bind(promise);
    builder.catch = promise.catch.bind(promise);

    return builder;
  }

  return {
    from: vi.fn(() => {
      const response = responses[callIndex] || {
        data: null,
        error: { message: "Unexpected query" },
      };
      callIndex++;
      return createChainableBuilder(response);
    }),
  };
}
