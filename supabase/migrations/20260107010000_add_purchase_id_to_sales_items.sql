-- =========================
-- Add purchase_id to sales_items for purchase attribution
-- =========================

alter table public.sales_items
add column if not exists purchase_id uuid references public.acquisitions(id) on delete set null;

create index if not exists idx_sales_items_purchase on public.sales_items(purchase_id) where purchase_id is not null;

