-- Performance optimization: Add missing indexes for frequently queried columns
-- Based on analysis of API route queries

-- Sales Orders: frequently queried by sold_at for sorting and date filtering
create index if not exists idx_sales_orders_sold_at on public.sales_orders(sold_at desc);

-- Composite index for common query pattern: orders by date with buyer
create index if not exists idx_sales_orders_sold_at_buyer on public.sales_orders(sold_at desc, buyer_id);

-- Buyers: frequently searched by handle (ilike queries)
create index if not exists idx_buyers_handle on public.buyers(handle);

-- Composite index for buyer lookups by platform and handle
create index if not exists idx_buyers_platform_handle on public.buyers(platform, handle);

-- Sales Items: frequently queried by sales_order_id (already indexed, but ensure it exists)
-- Also need index for queries filtering by lot_id and order_id together
create index if not exists idx_sales_items_order_lot on public.sales_items(sales_order_id, lot_id);

-- Inventory Lots: composite index for status + for_sale lookups (common pattern)
create index if not exists idx_lots_status_for_sale on public.inventory_lots(status, for_sale) 
  where status in ('draft', 'ready', 'listed') and for_sale = true;

-- Inventory Lots: index for acquisition_id lookups (already exists but verify)
-- Composite index for card_id + status (common for inventory views)
create index if not exists idx_lots_card_status on public.inventory_lots(card_id, status);

-- Bundle Items: composite index for bundle_id + lot_id lookups
create index if not exists idx_bundle_items_bundle_lot on public.bundle_items(bundle_id, lot_id);

-- Acquisitions: index for date-based queries (if not exists)
create index if not exists idx_acquisitions_purchased_at on public.acquisitions(purchased_at desc);

-- Intake Lines: index for status lookups (already exists, but ensure)
-- Composite index for acquisition_id + status (common pattern)
create index if not exists idx_intake_lines_acq_status on public.intake_lines(acquisition_id, status);

-- Cards: index for name searches (already exists, but may need text search optimization)
-- For better text search, consider GIN index on name column
-- create index if not exists idx_cards_name_gin on public.cards using gin(to_tsvector('english', name));

-- Sales Orders: index for bundle_id lookups (already exists with WHERE clause, but ensure non-null index too)
-- The existing index only covers non-null bundle_id, so this is already optimized

-- Analytics queries: index for dashboard date-based aggregations
-- The sold_at index above should help with this

COMMENT ON INDEX idx_sales_orders_sold_at IS 'Optimizes date-based sorting and filtering of sales orders';
COMMENT ON INDEX idx_buyers_handle IS 'Optimizes buyer search by handle (ilike queries)';
COMMENT ON INDEX idx_lots_status_for_sale IS 'Optimizes queries for available lots (status + for_sale filter)';
COMMENT ON INDEX idx_bundle_items_bundle_lot IS 'Optimizes bundle item lookups by bundle and lot';

