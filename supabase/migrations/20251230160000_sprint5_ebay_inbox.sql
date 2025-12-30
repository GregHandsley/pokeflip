-- =========================
-- Sprint 5: eBay Inbox / Listing Queue
-- =========================

-- 1) Add columns to inventory_lots for publish queue tracking
alter table public.inventory_lots
add column if not exists ebay_publish_queued_at timestamptz,
add column if not exists ebay_last_error text;

-- 2) Create ebay_publish_jobs table for durable queue
-- Allow multiple jobs per lot but only one active (queued or running) at a time
create table if not exists public.ebay_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.inventory_lots(id) on delete cascade,
  status text not null check (status in ('queued','running','succeeded','failed')) default 'queued',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ebay_publish_jobs_status on public.ebay_publish_jobs(status);
create index if not exists idx_ebay_publish_jobs_lot on public.ebay_publish_jobs(lot_id);

-- Update trigger for ebay_publish_jobs
drop trigger if exists trg_ebay_publish_jobs_touch on public.ebay_publish_jobs;
create trigger trg_ebay_publish_jobs_touch
before update on public.ebay_publish_jobs
for each row execute function public.touch_updated_at();

-- 3) Add rarity ranking helper (create a function to map rarity to rank)
-- Common=1, Uncommon=2, Rare=3, Rare Holo=4, Ultra Rare=5, Secret Rare=6
create or replace function public.rarity_to_rank(rarity_text text)
returns int
language plpgsql
immutable
as $$
begin
  if rarity_text is null then
    return 0;
  end if;
  
  case upper(rarity_text)
    when 'COMMON' then return 1;
    when 'UNCOMMON' then return 2;
    when 'RARE' then return 3;
    when 'RARE HOLO', 'RARE HOLOGRAPHIC', 'HOLO RARE' then return 4;
    when 'ULTRA RARE', 'ULTRA RARE EX', 'ULTRA RARE GX', 'ULTRA RARE V', 'ULTRA RARE VMAX', 'ULTRA RARE VSTAR' then return 5;
    when 'SECRET RARE', 'SECRET RARE GOLD', 'SECRET RARE RAINBOW' then return 6;
    else
      -- Try to detect rare patterns
      if upper(rarity_text) like '%SECRET%' then return 6;
      elsif upper(rarity_text) like '%ULTRA%' then return 5;
      elsif upper(rarity_text) like '%HOLO%' or upper(rarity_text) like '%HOLOGRAPHIC%' then return 4;
      elsif upper(rarity_text) like '%RARE%' then return 3;
      else return 0;
      end if;
  end case;
end $$;

-- 4) Create inbox view with all necessary fields
create or replace view public.v_ebay_inbox_lots as
with lot_sold_totals as (
  select 
    lot_id,
    sum(qty)::int as sold_qty
  from public.sales_items
  group by lot_id
),
lot_photo_counts as (
  select
    lot_id,
    count(*)::int as photo_count
  from public.lot_photos
  group by lot_id
)
select
  l.id as lot_id,
  l.card_id,
  c.number as card_number,
  c.name as card_name,
  s.name as set_name,
  c.rarity,
  public.rarity_to_rank(c.rarity) as rarity_rank,
  l.condition,
  l.status,
  l.for_sale,
  l.list_price_pence,
  l.quantity,
  coalesce(l.quantity - st.sold_qty, l.quantity)::int as available_qty,
  coalesce(lpc.photo_count, 0)::int as photo_count,
  coalesce(el.status, 'not_listed'::public.ebay_listing_status) as ebay_status,
  el.id as ebay_listing_id,
  l.ebay_publish_queued_at,
  l.ebay_last_error,
  l.updated_at,
  l.created_at
from public.inventory_lots l
inner join public.cards c on c.id = l.card_id
inner join public.sets s on s.id = c.set_id
left join lot_sold_totals st on st.lot_id = l.id
left join lot_photo_counts lpc on lpc.lot_id = l.id
left join public.ebay_listings el on el.lot_id = l.id
where 
  l.for_sale = true
  and l.status in ('ready', 'draft')  -- Include both ready and draft by default
  and coalesce(el.status, 'not_listed'::public.ebay_listing_status) != 'live'
  and coalesce(l.quantity - st.sold_qty, l.quantity) > 0
  and l.ebay_publish_queued_at is null;  -- Exclude lots that are already queued

-- 5) Add indexes for inbox queries
create index if not exists idx_lots_for_sale_status on public.inventory_lots(for_sale, status);
create index if not exists idx_lots_list_price on public.inventory_lots(list_price_pence) where list_price_pence is not null;
create index if not exists idx_ebay_listings_lot_status on public.ebay_listings(lot_id, status);

-- 6) Add app_config table for settings (valuable threshold, etc.)
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

-- Insert default valuable threshold (can be overridden)
insert into public.app_config (key, value, description)
values ('valuable_threshold_gbp', '10.00', 'Price threshold in GBP for marking lots as valuable')
on conflict (key) do nothing;

-- 7) Grant access
grant select on public.v_ebay_inbox_lots to authenticated;
grant all on public.ebay_publish_jobs to authenticated;
grant all on public.app_config to authenticated;

