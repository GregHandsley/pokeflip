# Database Security Documentation

## Overview

This document describes the database security setup for the Pokeflip application, including Row Level Security (RLS) policies and service role key usage.

## Row Level Security (RLS)

### Status
✅ **Enabled on all application tables**

RLS is enabled on all tables in the `public` schema to ensure that only authenticated users can access data. Since this is a single-user application, authenticated users have full access (SELECT, INSERT, UPDATE, DELETE) to all tables.

### Tables with RLS Enabled

The following tables have RLS enabled with policies for authenticated users:

- `sets` - Card set catalog
- `cards` - Card catalog
- `inventory_lots` - Inventory lots
- `ebay_listings` - eBay listing tracking
- `acquisitions` - Purchase records
- `intake_lines` - Intake line items
- `buyers` - Buyer information
- `sales_orders` - Sales orders
- `sales_items` - Sales line items
- `consumables` - Consumable items
- `consumable_purchases` - Consumable purchase records
- `sales_consumables` - Consumables used in sales
- `lot_photos` - Lot photo references
- `intake_line_photos` - Intake line photo references
- `packaging_rules` - Packaging rules
- `packaging_rule_items` - Packaging rule items
- `app_config` - Application configuration
- `ebay_accounts` - eBay account information
- `ebay_tokens` - eBay OAuth tokens
- `ebay_policies` - eBay policy references
- `ebay_templates` - eBay listing templates
- `ebay_oauth_states` - eBay OAuth state tracking
- `ebay_publish_jobs` - eBay publish job queue
- `jobs` - Background job queue
- `job_logs` - Job execution logs
- `lot_purchase_history` - Lot purchase history
- `market_snapshots` - Market price snapshots
- `market_watchlist` - Market watchlist
- `price_alerts` - Price alert subscriptions
- `promotional_deals` - Promotional deal definitions
- `set_translations` - Set name translations
- `bundles` - Bundle definitions
- `bundle_items` - Bundle item associations
- `bundle_photos` - Bundle photo references
- `sales_item_purchase_allocations` - Purchase cost allocations

### RLS Policies

Each table has four policies for authenticated users:

1. **SELECT Policy**: `authenticated_select_{table_name}`
   - Allows authenticated users to read all rows
   - Policy: `using (true)`

2. **INSERT Policy**: `authenticated_insert_{table_name}`
   - Allows authenticated users to insert new rows
   - Policy: `with check (true)`

3. **UPDATE Policy**: `authenticated_update_{table_name}`
   - Allows authenticated users to update all rows
   - Policy: `using (true) with check (true)`

4. **DELETE Policy**: `authenticated_delete_{table_name}`
   - Allows authenticated users to delete rows
   - Policy: `using (true)`

### Views

Views are granted SELECT access to authenticated users:

- `v_card_inventory_totals` - Card inventory summary
- `v_consumable_costs` - Consumable cost calculations
- `v_sales_order_profit` - Sales order profit calculations
- `v_ebay_inbox_lots` - eBay inbox lot view

### Functions

The following functions are granted EXECUTE access to authenticated users:

- `commit_acquisition(uuid)` - Commit intake lines to inventory
- `get_consumable_avg_cost(uuid)` - Calculate consumable average cost
- `generate_sku(text, text, text)` - Generate SKU for lot
- `get_or_create_sku(text, text, text)` - Get or create SKU
- `rarity_to_rank(text)` - Convert rarity text to rank
- `touch_updated_at()` - Update timestamp trigger function
- `touch_packaging_rules_updated_at()` - Update packaging rules timestamp
- `update_bundle_updated_at()` - Update bundle timestamp
- `update_lot_status_on_sale()` - Update lot status on sale
- `auto_create_lot_purchase_history()` - Auto-create purchase history
- `cleanup_expired_oauth_states()` - Cleanup expired OAuth states
- `log_job_event(uuid, text, text)` - Log job events
- `update_set_translations_updated_at()` - Update set translations timestamp

## Service Role Key Usage

### Overview

The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is a powerful credential that bypasses RLS policies. It should **only** be used server-side and **never** exposed to the client.

### Current Usage

The service role key is currently used in the following locations:

#### 1. Server-Side Supabase Client (`apps/admin/src/lib/supabase/server.ts`)

```typescript
export const supabaseServer = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
    { auth: { persistSession: false } }
  );
```

**Purpose**: Creates a Supabase client for server-side API routes that bypasses RLS.

**Security**: ✅ Safe - This file is server-only (not imported in client components).

#### 2. Photo Upload Routes

The service role key is used indirectly through `supabaseServer()` in the following routes:

- `apps/admin/src/app/api/admin/lots/[lotId]/photos/upload/route.ts`
- `apps/admin/src/app/api/admin/intake-lines/[lineId]/photos/upload/route.ts`
- `apps/admin/src/app/api/admin/bundles/[bundleId]/photos/upload/route.ts`

**Purpose**: Upload photos to the private `card-photos` storage bucket.

**Security**: ✅ Safe - These are API routes that run server-side only.

### Security Best Practices

1. ✅ **Server-Only Usage**: The service role key is only used in:
   - Server-side API routes (`/api/**`)
   - Server-side utility functions (`lib/supabase/server.ts`)

2. ✅ **Environment Variable**: The key is stored in `process.env.SUPABASE_SERVICE_ROLE_KEY`, which is:
   - Not exposed to the client
   - Not included in client-side bundles
   - Only accessible in server-side code

3. ✅ **No Client Exposure**: The service role key is never:
   - Imported in client components (`"use client"` files)
   - Exposed in browser JavaScript
   - Sent to the client in API responses

4. ⚠️ **Future Considerations**:
   - Consider using service role key only for operations that truly require bypassing RLS (e.g., admin operations, background jobs)
   - For regular CRUD operations, prefer using the anon key with RLS policies
   - Monitor service role key usage in logs to detect any unauthorized access

### Verification

To verify the service role key is not exposed:

1. **Check Build Output**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is not in client bundles
2. **Check Environment Variables**: Ensure it's not in `NEXT_PUBLIC_*` variables
3. **Code Review**: Ensure it's only imported in server-side files

## Storage Bucket Security

### Card Photos Bucket

The `card-photos` storage bucket has RLS policies:

- **Upload**: Authenticated users can upload to `lots/*` paths
- **Read**: Authenticated users can read all photos (for signed URLs)
- **Delete**: Authenticated users can delete photos

These policies work in conjunction with the service role key usage for uploads, ensuring that:
1. Client-side uploads use the anon key and are restricted by RLS
2. Server-side uploads use the service role key for flexibility

## Migration History

- **2026-01-07**: Initial RLS setup on all tables (`20260107213359_enable_rls_on_all_tables.sql`)

## Future Enhancements

1. **Multi-User Support**: If the application becomes multi-user, RLS policies should be updated to filter by `user_id` or similar
2. **Role-Based Access**: Consider implementing role-based access control (RBAC) for different user types
3. **Audit Logging**: Add audit logging for sensitive operations
4. **Service Role Key Rotation**: Implement a process for rotating the service role key periodically

