-- =========================
-- Sprint 4: Inventory enhancements
-- =========================

-- 1) Add lot_photos table for optional photo storage
-- Note: inventory_lots must exist first (created in sprint1 migration)
create table if not exists public.lot_photos (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null,
  kind text not null check (kind in ('front','back','extra')),
  object_key text not null,
  created_at timestamptz not null default now()
);

-- Add foreign key constraint separately (in case table already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'lot_photos_lot_id_fkey'
  ) then
    alter table public.lot_photos
    add constraint lot_photos_lot_id_fkey
    foreign key (lot_id)
    references public.inventory_lots(id)
    on delete cascade;
  end if;
end $$;

create index if not exists idx_lot_photos_lot on public.lot_photos(lot_id);

-- 2) Update v_card_inventory_totals view to account for sold qty from sales_items
--    and match the spec requirements
drop view if exists public.v_card_inventory_totals;

create or replace view public.v_card_inventory_totals as
with lot_sold_totals as (
  select 
    lot_id,
    sum(qty)::int as sold_qty
  from public.sales_items
  group by lot_id
)
select
  c.id as card_id,
  c.set_id,
  s.name as set_name,
  c.number as card_number,
  c.name as card_name,
  c.rarity,
  c.api_image_url as image_url,
  -- qty_on_hand: sum of available qty (quantity - sold_qty) for non-sold lots
  coalesce(
    sum(
      case 
        when l.status in ('draft','ready','listed') 
        then greatest(0, l.quantity - coalesce(st.sold_qty, 0))
        else 0 
      end
    )::int,
    0
  ) as qty_on_hand,
  -- qty_for_sale: sum of available qty where for_sale = true
  coalesce(
    sum(
      case 
        when l.status in ('draft','ready','listed') 
          and l.for_sale = true
        then greatest(0, l.quantity - coalesce(st.sold_qty, 0))
        else 0 
      end
    )::int,
    0
  ) as qty_for_sale,
  -- qty_sold: sum of quantity for lots with status='sold'
  coalesce(
    sum(
      case 
        when l.status = 'sold' 
        then l.quantity
        else 0 
      end
    )::int,
    0
  ) as qty_sold,
  -- active_lot_count: count of lots with status in (draft, ready, listed)
  count(distinct case when l.status in ('draft','ready','listed') then l.id end)::int as active_lot_count,
  -- sold_lot_count: count of lots with status = 'sold'
  count(distinct case when l.status = 'sold' then l.id end)::int as sold_lot_count,
  -- updated_at_max: latest lot update
  max(l.updated_at) as updated_at_max
from public.cards c
left join public.sets s on s.id = c.set_id
left join public.inventory_lots l on l.card_id = c.id
left join lot_sold_totals st on st.lot_id = l.id
group by c.id, c.set_id, s.name, c.number, c.name, c.rarity, c.api_image_url;

-- 3) Add composite index for status + card_id lookups (for performance)
create index if not exists idx_lots_status_card on public.inventory_lots(status, card_id);

-- 4) Add index on sales_items(lot_id) if not exists
create index if not exists idx_sales_items_lot on public.sales_items(lot_id);

