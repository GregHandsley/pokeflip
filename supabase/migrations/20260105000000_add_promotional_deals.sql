-- =========================
-- Promotional Deals
-- =========================

create table if not exists public.promotional_deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  deal_type text not null check (deal_type in ('percentage_off', 'fixed_off', 'free_shipping', 'buy_x_get_y')),
  -- For percentage_off: discount_percent (e.g., 10 for 10% off)
  -- For fixed_off: discount_amount_pence (e.g., 100 for £1 off)
  -- For free_shipping: no additional fields needed
  -- For buy_x_get_y: buy_quantity (e.g., 3), get_quantity (e.g., 1), discount_percent (e.g., 10 for 10% off the get items)
  discount_percent numeric(5,2), -- e.g., 10.00 for 10%
  discount_amount_pence int, -- e.g., 100 for £1
  buy_quantity int, -- For buy_x_get_y deals
  get_quantity int, -- For buy_x_get_y deals
  min_card_count int default 1, -- Minimum number of cards required
  max_card_count int, -- Maximum number of cards (null = unlimited)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_promotional_deals_active on public.promotional_deals(is_active);

-- Update trigger
drop trigger if exists trg_promotional_deals_touch on public.promotional_deals;
create trigger trg_promotional_deals_touch
before update on public.promotional_deals
for each row execute function public.touch_updated_at();


