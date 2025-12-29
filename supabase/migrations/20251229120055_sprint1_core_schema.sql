-- Enable required extension (Supabase usually enables this, but safe)
create extension if not exists pgcrypto;

-- =========================
-- 1) Catalog cache (sets/cards)
-- =========================

create table if not exists public.sets (
  id text primary key,              -- e.g. "sv4" or API id
  name text not null,
  series text,
  release_date date,
  api_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id text primary key,              -- API card id
  set_id text not null references public.sets(id) on delete cascade,
  number text not null,
  name text not null,
  rarity text,
  api_image_url text,               -- front image from API
  api_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(set_id, number)
);

create index if not exists idx_cards_set on public.cards(set_id);
create index if not exists idx_cards_name on public.cards(name);

-- =========================
-- 2) Inventory lots (bulk-friendly)
-- =========================

create type public.lot_status as enum ('draft','ready','listed','sold','archived');

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.cards(id) on delete restrict,
  condition text not null check (condition in ('NM','LP','MP','HP','DMG')),
  quantity int not null check (quantity >= 0),
  for_sale boolean not null default true,
  list_price_pence int, -- nullable when not for sale
  note text,
  photo_front_path text,
  photo_back_path text,
  status public.lot_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lots_card on public.inventory_lots(card_id);
create index if not exists idx_lots_status on public.inventory_lots(status);
create index if not exists idx_lots_for_sale on public.inventory_lots(for_sale);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_lots_touch on public.inventory_lots;
create trigger trg_lots_touch
before update on public.inventory_lots
for each row execute function public.touch_updated_at();

-- =========================
-- 3) eBay listing placeholder (linked to lot)
-- =========================

create type public.ebay_listing_status as enum ('not_listed','pending','live','ended','failed');

create table if not exists public.ebay_listings (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.inventory_lots(id) on delete cascade,
  sku text not null, -- e.g. "LOT-{lot_id}"
  offer_id text,
  listing_id text,
  status public.ebay_listing_status not null default 'not_listed',
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(lot_id)
);

-- =========================
-- 4) Acquisitions + intake lines
-- =========================

create type public.acquisition_status as enum ('open','closed');
create type public.intake_status as enum ('draft','committed');

create table if not exists public.acquisitions (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,               -- "eBay seller", "Local shop"
  source_type text not null default 'other', -- "packs", "collection", etc.
  reference text,                          -- optional receipt/order id
  purchase_total_pence int not null check (purchase_total_pence >= 0),
  purchased_at timestamptz not null default now(),
  notes text,
  status public.acquisition_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.intake_lines (
  id uuid primary key default gen_random_uuid(),
  acquisition_id uuid not null references public.acquisitions(id) on delete cascade,
  set_id text not null references public.sets(id) on delete restrict,
  card_id text not null references public.cards(id) on delete restrict,
  condition text not null check (condition in ('NM','LP','MP','HP','DMG')),
  quantity int not null check (quantity > 0),
  for_sale boolean not null default true,
  list_price_pence int,
  note text,
  status public.intake_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index if not exists idx_intake_acq on public.intake_lines(acquisition_id);
create index if not exists idx_intake_status on public.intake_lines(status);

-- =========================
-- 5) Sales placeholders
-- =========================

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'ebay',
  handle text,
  created_at timestamptz not null default now(),
  unique(platform, handle)
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'ebay',
  platform_order_ref text,
  buyer_id uuid references public.buyers(id),
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  lot_id uuid not null references public.inventory_lots(id),
  qty int not null check (qty > 0),
  sold_price_pence int not null,
  created_at timestamptz not null default now()
);

-- =========================
-- 6) Consumables structure
-- =========================

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'each',
  created_at timestamptz not null default now()
);

create table if not exists public.consumable_purchases (
  id uuid primary key default gen_random_uuid(),
  consumable_id uuid not null references public.consumables(id),
  qty int not null check (qty > 0),
  total_cost_pence int not null check (total_cost_pence >= 0),
  purchased_at timestamptz not null default now()
);

create table if not exists public.sales_consumables (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  consumable_id uuid not null references public.consumables(id),
  qty int not null check (qty > 0)
);

-- =========================
-- 7) Totals view (card rollups)
-- =========================

create or replace view public.v_card_inventory_totals as
select
  c.id as card_id,
  c.set_id,
  c.number,
  c.name,
  c.rarity,
  c.api_image_url,
  sum(case when l.status in ('draft','ready','listed') then l.quantity else 0 end) as qty_active,
  sum(case when l.status = 'listed' then l.quantity else 0 end) as qty_listed,
  sum(case when l.status = 'sold' then l.quantity else 0 end) as qty_sold,
  max(case when l.for_sale and l.list_price_pence is not null then l.list_price_pence end) as max_list_price_pence
from public.cards c
left join public.inventory_lots l on l.card_id = c.id
group by c.id, c.set_id, c.number, c.name, c.rarity, c.api_image_url;

-- =========================
-- 8) Commit RPC: draft intake -> inventory lots (merge + increment)
-- =========================

create or replace function public.commit_acquisition(p_acquisition_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  -- lock acquisition row to avoid concurrent commits
  perform 1 from public.acquisitions where id = p_acquisition_id for update;

  select count(*) into v_count
  from public.intake_lines
  where acquisition_id = p_acquisition_id and status = 'draft';

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'message', 'No draft intake lines');
  end if;

  -- Merge draft lines into existing active lots if exact match, else create new lot.
  -- Match key: (card_id, condition, for_sale, list_price_pence) and active status.
  with grouped as (
    select
      card_id,
      condition,
      for_sale,
      list_price_pence,
      sum(quantity)::int as qty_sum
    from public.intake_lines
    where acquisition_id = p_acquisition_id and status = 'draft'
    group by card_id, condition, for_sale, list_price_pence
  ),
  matched as (
    select
      g.*,
      l.id as lot_id,
      l.quantity as lot_qty
    from grouped g
    left join lateral (
      select id, quantity
      from public.inventory_lots
      where card_id = g.card_id
        and condition = g.condition
        and for_sale = g.for_sale
        and ( (list_price_pence is null and g.list_price_pence is null)
              or (list_price_pence = g.list_price_pence) )
        and status in ('draft','ready','listed')
      order by created_at asc
      limit 1
    ) l on true
  ),
  upd as (
    update public.inventory_lots l
    set quantity = l.quantity + m.qty_sum,
        status = case when l.status = 'draft' then 'ready' else l.status end
    from matched m
    where m.lot_id is not null and l.id = m.lot_id
    returning l.id
  ),
  ins as (
    insert into public.inventory_lots (card_id, condition, quantity, for_sale, list_price_pence, status)
    select
      m.card_id, m.condition, m.qty_sum, m.for_sale, m.list_price_pence, 'ready'::public.lot_status
    from matched m
    where m.lot_id is null
    returning id
  )
  update public.intake_lines
  set status = 'committed'
  where acquisition_id = p_acquisition_id and status = 'draft';

  return jsonb_build_object('ok', true, 'message', 'Committed intake lines', 'draft_lines_committed', v_count);
end $$;

-- grant execute for authenticated (you can tighten this later with RLS/policies)
grant execute on function public.commit_acquisition(uuid) to authenticated;

