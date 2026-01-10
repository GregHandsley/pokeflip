-- =========================
-- Add quantity to bundles
-- =========================

-- Add quantity field to bundles table (how many of this bundle are available)
alter table public.bundles
add column if not exists quantity int not null default 1 check (quantity >= 0);

-- Add index for better query performance
create index if not exists idx_bundles_quantity on public.bundles(quantity) where quantity > 0;

