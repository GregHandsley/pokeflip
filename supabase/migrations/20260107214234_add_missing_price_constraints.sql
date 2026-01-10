-- =========================
-- Add missing check constraints for price fields
-- =========================
-- This migration adds constraints to ensure prices are positive when set

-- Add constraint for list_price_pence in inventory_lots
-- When set, it must be > 0 (it's nullable, but when not null, must be positive)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'inventory_lots_list_price_pence_positive'
  ) then
    alter table public.inventory_lots
    add constraint inventory_lots_list_price_pence_positive
    check (list_price_pence is null or list_price_pence > 0);
  end if;
end $$;

-- Add constraint for list_price_pence in intake_lines
-- When set, it must be > 0 (it's nullable, but when not null, must be positive)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'intake_lines_list_price_pence_positive'
  ) then
    alter table public.intake_lines
    add constraint intake_lines_list_price_pence_positive
    check (list_price_pence is null or list_price_pence > 0);
  end if;
end $$;

-- Add constraint for sold_price_pence in sales_items
-- Must be > 0 (not nullable, so always must be positive)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'sales_items_sold_price_pence_positive'
  ) then
    alter table public.sales_items
    add constraint sales_items_sold_price_pence_positive
    check (sold_price_pence > 0);
  end if;
end $$;

-- Add constraint for price_pence in market_snapshots
-- Must be > 0
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'market_snapshots_price_pence_positive'
  ) then
    alter table public.market_snapshots
    add constraint market_snapshots_price_pence_positive
    check (price_pence > 0);
  end if;
end $$;

-- Add constraint for new_price_pence in price_alerts
-- Must be > 0
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'price_alerts_new_price_pence_positive'
  ) then
    alter table public.price_alerts
    add constraint price_alerts_new_price_pence_positive
    check (new_price_pence > 0);
  end if;
end $$;

-- Add constraint for old_price_pence in price_alerts (if set, must be > 0)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'price_alerts_old_price_pence_positive'
  ) then
    alter table public.price_alerts
    add constraint price_alerts_old_price_pence_positive
    check (old_price_pence is null or old_price_pence > 0);
  end if;
end $$;

-- Note: discount_amount_pence in promotional_deals should be >= 0 (can be 0 for free shipping)
-- Let's add a constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'promotional_deals_discount_amount_pence_non_negative'
  ) then
    alter table public.promotional_deals
    add constraint promotional_deals_discount_amount_pence_non_negative
    check (discount_amount_pence is null or discount_amount_pence >= 0);
  end if;
end $$;

-- Note: discount_percent in promotional_deals should be 0-100
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'promotional_deals_discount_percent_range'
  ) then
    alter table public.promotional_deals
    add constraint promotional_deals_discount_percent_range
    check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));
  end if;
end $$;

