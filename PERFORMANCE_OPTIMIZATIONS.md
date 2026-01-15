# Performance Optimizations

This document outlines the performance optimizations implemented to improve the application's speed and user experience.

## 1. Database Indexes ✅

**Location**: `supabase/migrations/20260110000000_performance_indexes.sql`

### Added Indexes:

- `idx_sales_orders_sold_at` - Optimizes date-based sorting and filtering of sales orders
- `idx_sales_orders_sold_at_buyer` - Composite index for common query pattern
- `idx_buyers_handle` - Optimizes buyer search by handle (ilike queries)
- `idx_buyers_platform_handle` - Composite index for buyer lookups
- `idx_sales_items_order_lot` - Composite index for sales items queries
- `idx_lots_status_for_sale` - Optimizes queries for available lots
- `idx_lots_card_status` - Composite index for inventory views
- `idx_bundle_items_bundle_lot` - Optimizes bundle item lookups
- `idx_acquisitions_purchased_at` - Index for date-based queries
- `idx_intake_lines_acq_status` - Composite index for intake line queries

### Impact:

- Faster queries on frequently filtered/sorted columns
- Improved JOIN performance
- Reduced database load

## 2. Catalog Data Caching ✅

### Server-Side Caching

**Location**:

- `apps/admin/src/app/api/catalog/sets/route.ts`
- `apps/admin/src/app/api/catalog/cards/route.ts`

Using Next.js `unstable_cache` with:

- **TTL**: 1 hour (3600 seconds)
- **Revalidation**: Automatic after TTL expires
- **Tags**: For potential manual cache invalidation

### Client-Side Caching

**Location**: `apps/admin/src/lib/cache/catalog-cache.ts`

In-memory cache with:

- **TTL**: 1 hour default
- **AbortController**: Prevents race conditions
- **Cache key management**: Organized by locale and setId

### Updated Hooks:

- `useCatalogSets` - Now uses client-side cache
- `useTcgdxSets` - Now uses client-side cache
- `useTcgdxCards` - Now uses client-side cache

### Impact:

- Reduced external API calls to TCGdx
- Faster repeated catalog loads
- Better user experience with instant cached data

## 3. Loading States ✅

Most components already have loading states. The following were reviewed and enhanced:

### Components with Loading States:

- ✅ Dashboard components (`AdminHome`, `TestStatus`)
- ✅ Analytics components (`OperationalDashboard`, `CardAnalyticsPanel`)
- ✅ Inventory components (`InventoryBySet`, `CardLotsView`)
- ✅ Sales components (`SalesPage`)
- ✅ Bundle components (`SoldBundleDetailsModal`, `SellBundleModal`)
- ✅ Catalog hooks (`useCatalogSets`, `useTcgdxSets`, `useTcgdxCards`)

### Improvements Made:

- Added AbortController support to prevent race conditions
- Enhanced error handling in async operations
- Consistent loading state patterns

## 4. Image Optimization ✅

**Location**: `apps/admin/src/components/ui/OptimizedImage.tsx`

### Features:

- **Lazy Loading**: Uses native `loading="lazy"` attribute
- **WebP Support**: Automatically adds quality suffixes (`/low.webp`, `/medium.webp`, `/high.webp`)
- **Loading States**: Shows placeholder during image load
- **Error Handling**: Graceful fallback on image load failure
- **Quality Control**: Configurable quality levels
- **Async Decoding**: Uses `decoding="async"` for better performance

### Updated Components:

- `InventoryCard` - Now uses `OptimizedImage`

### Usage:

```tsx
<OptimizedImage
  src={api_image_url}
  alt="Card name"
  className="h-12 w-auto rounded"
  quality="low" // or "medium", "high"
  priority={false} // true for above-the-fold images
/>
```

### Impact:

- Reduced initial page load time
- Lower bandwidth usage
- Better perceived performance

## 5. Virtual Scrolling (Pending)

Virtual scrolling is recommended for large lists but requires careful implementation. The following lists could benefit:

### Candidates:

1. **InventoryBySet** - Could be hundreds of cards
2. **CardGrid** - Displays all cards in a set (can be 200+)
3. **Sales Orders List** - Can grow large over time
4. **Bundles List** - Can have many bundles

### Recommendation:

Consider implementing virtual scrolling using `react-window` or `react-virtuoso` for:

- Card grids (100+ items)
- Sales history (pagination exists, but could be enhanced)
- Inventory lists

### Current Status:

- Pagination exists for some lists (InboxTable)
- Most lists are manageable in size currently
- Monitor performance and add virtual scrolling if needed

## 6. Additional Optimizations

### Query Optimization:

- Using `Promise.all()` for parallel queries where possible
- Composite indexes for common query patterns
- Efficient filtering at database level

### Component Optimization:

- `useMemo` for expensive computations (filtering, grouping)
- `useCallback` for stable function references
- Proper dependency arrays in hooks

## Performance Monitoring

### Metrics to Track:

1. **API Response Times**: Monitor catalog API calls
2. **Database Query Performance**: Use Supabase dashboard
3. **Client-Side Rendering**: Monitor React render times
4. **Image Load Times**: Track image performance

### Tools:

- Browser DevTools (Network, Performance tabs)
- Supabase Dashboard (Query performance)
- React DevTools Profiler

## Future Improvements

1. **Service Worker**: For offline catalog caching
2. **Image CDN**: For faster image delivery
3. **Database Connection Pooling**: For better concurrent performance
4. **API Rate Limiting**: Prevent abuse
5. **GraphQL**: Consider for complex data fetching patterns
6. **Incremental Static Regeneration**: For catalog pages

## Testing

To verify performance improvements:

1. **Database Indexes**: Check query execution plans in Supabase
2. **Caching**: Monitor network tab for cache hits
3. **Images**: Check image load times in DevTools
4. **Loading States**: Verify no "flash of unstyled content"

## Notes

- Catalog cache TTL can be adjusted based on update frequency
- Image quality can be optimized per use case (thumbnails vs full view)
- Virtual scrolling should be added when lists exceed 100 items consistently
