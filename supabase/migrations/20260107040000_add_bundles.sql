-- =========================
-- Add bundles system for combining cards
-- =========================

-- Bundles table: stores bundle information
create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_pence int not null check (price_pence > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'sold', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bundles_status on public.bundles(status);

-- Bundle items: tracks which lots are in each bundle
create table if not exists public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  lot_id uuid not null references public.inventory_lots(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(bundle_id, lot_id)
);

create index if not exists idx_bundle_items_bundle on public.bundle_items(bundle_id);
create index if not exists idx_bundle_items_lot on public.bundle_items(lot_id);

-- Add bundle_id to sales_orders to track bundle sales
alter table public.sales_orders
add column if not exists bundle_id uuid references public.bundles(id) on delete set null;

create index if not exists idx_sales_orders_bundle on public.sales_orders(bundle_id) where bundle_id is not null;

-- Function to update bundle updated_at timestamp
create or replace function public.update_bundle_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.bundles
  set updated_at = now()
  where id = NEW.bundle_id;
  return NEW;
end;
$$;

create trigger trg_update_bundle_updated_at
after insert or update on public.bundle_items
for each row execute function public.update_bundle_updated_at();

