-- =========================
-- Add order group and fees/shipping to sales_orders
-- =========================

-- Add order_group field to sales_orders
alter table public.sales_orders
add column if not exists order_group text;

-- Add fees and shipping fields
alter table public.sales_orders
add column if not exists fees_pence int check (fees_pence >= 0),
add column if not exists shipping_pence int check (shipping_pence >= 0);

-- Create index on order_group for grouping orders
create index if not exists idx_sales_orders_order_group on public.sales_orders(order_group);

-- Create index on buyer_id for buyer stats
create index if not exists idx_sales_orders_buyer on public.sales_orders(buyer_id);

