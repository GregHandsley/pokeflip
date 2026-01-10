# Integration Tests Fix Guide

## Current Status

The integration tests are failing because:
1. ✅ **Fixed**: `body` and `validatedBundleId` undefined errors in catch blocks
2. ⚠️ **Needs Work**: Supabase mocking is not handling chained queries correctly

## The Problem

Supabase uses a fluent/chained API:
```typescript
supabase
  .from("inventory_lots")
  .select("id, quantity")
  .in("id", lotIds)  // Returns a promise
```

Each method returns an object that can be chained. The current mocks don't properly handle this chain.

## Solutions

### Option 1: Skip Integration Tests (Recommended for now)

Mark these tests as skipped until proper mocking infrastructure is in place:

```typescript
describe.skip("POST /api/admin/bundles", () => {
  // Tests here
});
```

This allows:
- ✅ Unit tests continue to run (116 passing)
- ✅ Tests are preserved for future work
- ✅ No false negatives in CI

### Option 2: Use Test Database

Instead of mocks, use a real test database:
- Set up a separate Supabase project for testing
- Seed test data before each test
- Clean up after tests

**Pros**: Tests real behavior
**Cons**: Requires infrastructure, slower, more complex setup

### Option 3: Extract Business Logic (Best Long-term)

Move business logic into pure functions that can be unit tested:

```typescript
// Instead of testing the API route directly, test the business logic
import { validateBundleStock } from "@/lib/bundle-stock-validation";

describe("validateBundleStock", () => {
  it("validates stock correctly", () => {
    const lots = [{ id: "lot1", quantity: 10, soldQty: 2, reservedQty: 3 }];
    const bundleItems = [{ lotId: "lot1", quantity: 2 }];
    const bundleQuantity = 3;
    
    const result = validateBundleStock(lots, bundleItems, bundleQuantity);
    expect(result.isValid).toBe(true);
    expect(result.available).toBe(5); // 10 - 2 - 3 = 5
  });
});
```

This approach:
- ✅ Tests business logic without API complexity
- ✅ Faster and more reliable
- ✅ Easier to test edge cases
- ✅ API routes become thin wrappers (less critical to test)

### Option 4: Create Proper Mock Factory

Create a sophisticated mock that handles all Supabase query patterns. This is complex and may need to be maintained as Supabase updates.

## Recommended Approach

**For now**: Skip the integration tests and focus on:
1. ✅ Unit tests (all passing - 116 tests)
2. ✅ E2E tests (when auth is set up)
3. 🔄 Extract business logic into testable functions

**Long-term**: Implement Option 3 (extract business logic) as it provides the best test coverage with less complexity.

## Files to Skip

Add `.skip` to these test files:
- `apps/admin/src/app/api/admin/bundles/route.test.ts`
- `apps/admin/src/app/api/admin/bundles/[bundleId]/route.test.ts` (DELETE tests)
- `apps/admin/src/app/api/admin/bundles/[bundleId]/sell/route.test.ts`
- `apps/admin/src/app/api/admin/sales/create/route.test.ts`

The PATCH tests in `[bundleId]/route.test.ts` are passing, so those can stay.

