# Data Validation Guide

This guide explains how to use the validation utilities in API endpoints to ensure data integrity and security.

## Overview

The validation system provides:

- **Type-safe validation** for all API inputs
- **Consistent error responses** with detailed field-level errors
- **Database constraints** to enforce data integrity at the database level
- **Business rule validation** for complex scenarios

## Validation Library

The validation utilities are located in `apps/admin/src/lib/validation.ts`.

### Basic Validators

```typescript
import {
  required,
  string,
  number,
  integer,
  boolean,
  uuid,
  positive,
  nonNegative,
  min,
  max,
  range,
  enumValue,
  array,
  nonEmptyArray,
  optional,
} from "@/lib/validation";
```

### Common Patterns

#### 1. Required Fields

```typescript
const name = required(body.name, "name");
const email = required(body.email, "email");
```

#### 2. Type Validation

```typescript
const price = number(body.price, "price");
const quantity = integer(body.quantity, "quantity");
const isActive = boolean(body.isActive, "isActive");
```

#### 3. Range Validation

```typescript
const price = positive(number(body.price, "price"), "price");
const quantity = min(integer(body.quantity, "quantity"), 1, "quantity");
const percentage = range(number(body.percentage, "percentage"), 0, 100, "percentage");
```

#### 4. Enum Validation

```typescript
import { cardCondition, lotStatus, dealType } from "@/lib/validation";

const condition = cardCondition(body.condition, "condition");
const status = lotStatus(body.status, "status");
const dealType = dealType(body.dealType, "dealType");
```

#### 5. UUID Validation

```typescript
const lotId = uuid(body.lotId, "lotId");
const bundleId = uuid(params.bundleId, "bundleId");
```

#### 6. Optional Fields

```typescript
const description = optional(body.description, string, "description");
const price = optional(body.price, (v) => positive(number(v, "price"), "price"), "price");
```

#### 7. Array Validation

```typescript
const items = nonEmptyArray(body.items, "items");
// Validate each item in the array
items.forEach((item, index) => {
  uuid(item.lotId, `items[${index}].lotId`);
  quantity(item.quantity, `items[${index}].quantity`);
});
```

## Example: API Endpoint with Validation

Here's a complete example of an API endpoint using validation:

```typescript
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";
import { uuid, boolean, optional, pricePence, ValidationErrorResponse } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ lotId: string }> }) {
  const logger = createApiLogger(req);

  try {
    // Validate route parameters
    const { lotId } = await params;
    const validatedLotId = uuid(lotId, "lotId");

    // Parse and validate request body
    const body = await req.json();
    const validatedForSale = boolean(required(body.for_sale, "for_sale"), "for_sale");
    const validatedPrice = optional(
      body.list_price_pence,
      (v) => pricePence(v, "list_price_pence"),
      "list_price_pence"
    );

    // Business rule: if for_sale is true and price is provided, it must be positive
    if (validatedForSale && validatedPrice !== undefined) {
      pricePence(validatedPrice, "list_price_pence");
    }

    const supabase = supabaseServer();

    // Prepare update object
    const updateData: {
      for_sale: boolean;
      list_price_pence?: number | null;
    } = {
      for_sale: validatedForSale,
    };

    if (validatedForSale && validatedPrice !== undefined) {
      updateData.list_price_pence = validatedPrice;
    } else if (!validatedForSale) {
      updateData.list_price_pence = null;
    }

    // Update the lot
    const { error } = await supabase
      .from("inventory_lots")
      .update(updateData)
      .eq("id", validatedLotId);

    if (error) {
      logger.error("Failed to update lot for_sale status", error, undefined, {
        lotId: validatedLotId,
        for_sale: validatedForSale,
        list_price_pence: validatedPrice,
      });
      return createErrorResponse(
        error.message || "Failed to update for_sale status",
        500,
        "UPDATE_FOR_SALE_FAILED",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Lot marked as ${validatedForSale ? "for sale" : "not for sale"}`,
    });
  } catch (error: unknown) {
    // ValidationErrorResponse is automatically handled by handleApiError
    return handleApiError(req, error, {
      operation: "update_for_sale",
      metadata: { lotId },
    });
  }
}
```

## Error Response Format

When validation fails, the API returns a standardized error response:

```json
{
  "ok": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "price",
      "message": "price must be at least 1",
      "code": "MIN_VALUE"
    },
    {
      "field": "lotId",
      "message": "lotId must be a valid UUID",
      "code": "INVALID_UUID"
    }
  ]
}
```

## Database Constraints

Database constraints provide a second layer of validation at the database level. They ensure data integrity even if validation is bypassed.

### Current Constraints

- **Prices**: `price_pence > 0` (when set)
- **Quantities**: `quantity >= 0` or `quantity > 0` (depending on context)
- **Enums**: Check constraints for status, condition, deal_type, etc.
- **Non-negative values**: `fees_pence >= 0`, `shipping_pence >= 0`, `discount_pence >= 0`

### Adding New Constraints

See migration: `20260107214234_add_missing_price_constraints.sql`

Example:

```sql
alter table public.inventory_lots
add constraint inventory_lots_list_price_pence_positive
check (list_price_pence is null or list_price_pence > 0);
```

## Validation Checklist

When creating or updating an API endpoint:

- [ ] Validate all required fields
- [ ] Validate data types (string, number, boolean, etc.)
- [ ] Validate ranges (min/max values)
- [ ] Validate enums (status, condition, etc.)
- [ ] Validate UUIDs
- [ ] Validate business rules (e.g., price > 0 when for_sale = true)
- [ ] Validate array contents if applicable
- [ ] Handle optional fields correctly
- [ ] Return appropriate error messages
- [ ] Ensure database constraints exist for critical fields

## Best Practices

1. **Validate Early**: Validate all inputs at the start of the handler
2. **Use Type-Safe Validators**: Use the provided validators instead of manual checks
3. **Provide Clear Errors**: Validation errors should clearly indicate what's wrong
4. **Validate Business Rules**: Don't just validate types, validate business logic
5. **Database Constraints**: Use database constraints as a safety net
6. **Consistent Error Format**: Use the validation error response format consistently

## Common Validation Patterns

### Pattern 1: Create Resource

```typescript
const name = nonEmptyString(body.name, "name");
const price = pricePence(body.pricePence, "pricePence");
const items = nonEmptyArray(body.items, "items");
items.forEach((item, i) => {
  uuid(item.lotId, `items[${i}].lotId`);
  quantity(item.quantity, `items[${i}].quantity`);
});
```

### Pattern 2: Update Resource

```typescript
const lotId = uuid(params.lotId, "lotId");
const updates: any = {};

if (body.name !== undefined) {
  updates.name = nonEmptyString(body.name, "name");
}
if (body.price !== undefined) {
  updates.price = pricePence(body.price, "price");
}
if (body.status !== undefined) {
  updates.status = lotStatus(body.status, "status");
}
```

### Pattern 3: Array of Objects

```typescript
const items = nonEmptyArray(body.items, "items");
const validatedItems = items.map((item, index) => {
  return {
    lotId: uuid(item.lotId, `items[${index}].lotId`),
    quantity: quantity(item.quantity, `items[${index}].quantity`),
    price: pricePence(item.price, `items[${index}].price`),
  };
});
```

## Migration Strategy

To add validation to existing endpoints:

1. **Start with Critical Endpoints**: Focus on endpoints that handle money, quantities, or sensitive data
2. **Add Validation Incrementally**: Don't try to update all endpoints at once
3. **Test Thoroughly**: Ensure validation doesn't break existing functionality
4. **Update Client Code**: Update client-side code to handle new validation errors
5. **Add Database Constraints**: Add constraints for critical fields

## Testing Validation

Test validation by sending invalid requests:

```bash
# Missing required field
curl -X POST /api/admin/bundles \
  -H "Content-Type: application/json" \
  -d '{"pricePence": 1000}'

# Invalid type
curl -X POST /api/admin/bundles \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "pricePence": "not-a-number"}'

# Invalid range
curl -X POST /api/admin/bundles \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "pricePence": -100}'

# Invalid enum
curl -X PATCH /api/admin/lots/123/status \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid_status"}'
```

Expected response:

```json
{
  "ok": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "name",
      "message": "name is required",
      "code": "REQUIRED"
    }
  ]
}
```
