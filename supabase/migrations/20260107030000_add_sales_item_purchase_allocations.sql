-- =========================
-- Track purchase allocations for sales items
-- Allows splitting a single sales_item across multiple purchases
-- =========================

create table if not exists public.sales_item_purchase_allocations (
  id uuid primary key default gen_random_uuid(),
  sales_item_id uuid not null references public.sales_items(id) on delete cascade,
  acquisition_id uuid not null references public.acquisitions(id) on delete cascade,
  qty int not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique(sales_item_id, acquisition_id)
);

create index if not exists idx_sales_item_purchase_allocations_item on public.sales_item_purchase_allocations(sales_item_id);
create index if not exists idx_sales_item_purchase_allocations_acquisition on public.sales_item_purchase_allocations(acquisition_id);

