/**
 * Helper utilities for mocking Supabase in tests
 * 
 * This provides a factory function to create properly chained Supabase mocks
 * that handle the complex query chaining (from().select().eq().in()...)
 */

import { vi } from "vitest";

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
    conditions: any;
    result: { data: any; error: any };
  }> = [];

  // Create a chainable mock builder
  function createChainableQueryBuilder(mockResult: { data: any; error: any }) {
    const builder: any = {
      select: vi.fn().mockReturnValue(builder),
      insert: vi.fn().mockReturnValue(builder),
      update: vi.fn().mockReturnValue(builder),
      delete: vi.fn().mockReturnValue(builder),
      eq: vi.fn().mockReturnValue(builder),
      neq: vi.fn().mockReturnValue(builder),
      in: vi.fn().mockReturnValue(builder),
      limit: vi.fn().mockReturnValue(builder),
      order: vi.fn().mockReturnValue(builder),
      single: vi.fn().mockResolvedValue(mockResult),
      // For queries that don't end in single(), resolve the promise directly
    };

    // Make the builder itself thenable (so await builder works)
    builder.then = (resolve: any) => Promise.resolve(mockResult).then(resolve);
    builder.catch = (reject: any) => Promise.resolve(mockResult).catch(reject);

    return builder;
  }

  const mockSupabase = {
    from: vi.fn((table: string) => {
      // Find matching query result
      // For now, return a chainable builder that eventually resolves
      // The actual implementation would need to match queries more intelligently
      return createChainableQueryBuilder({ data: null, error: null });
    }),
    
    // Helper method to register expected queries
    mockQuery: (table: string, config: {
      select?: any;
      where?: any;
      result: { data: any; error: any };
    }) => {
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
export function createSequentialSupabaseMock(responses: Array<{ data: any; error: any }>) {
  let callIndex = 0;

  function createChainableBuilder(result: { data: any; error: any }) {
    const builder: any = {};
    
    // All chain methods return the builder
    ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'limit', 'order'].forEach(method => {
      builder[method] = vi.fn().mockReturnValue(builder);
    });
    
    // single() resolves with the result
    builder.single = vi.fn().mockResolvedValue(result);
    
    // The builder itself can be awaited (returns a promise)
    builder.then = (onFulfilled: any) => Promise.resolve(result).then(onFulfilled);
    builder.catch = (onRejected: any) => Promise.resolve(result).catch(onRejected);
    
    return builder;
  }

  return {
    from: vi.fn(() => {
      const response = responses[callIndex] || { data: null, error: { message: 'Unexpected query' } };
      callIndex++;
      return createChainableBuilder(response);
    }),
  };
}

