-- =========================
-- Add SKU to inventory_lots
-- Each unique combination of (card_id, condition, variation) gets a unique SKU
-- All lots with the same combination share the same SKU
-- =========================

-- 1) Add sku column to inventory_lots
alter table public.inventory_lots
add column if not exists sku text;

create index if not exists idx_inventory_lots_sku on public.inventory_lots(sku) where sku is not null;

-- 2) Create function to generate SKU from card_id, condition, and variation
-- Format: PKM-{sanitized_card_id}-{condition}-{variation}
-- The sanitization removes special characters and limits length
create or replace function public.generate_sku(
  p_card_id text,
  p_condition text,
  p_variation text
)
returns text
language plpgsql
immutable
as $$
declare
  v_sanitized_card_id text;
  v_sku text;
begin
  -- Sanitize card_id: remove special characters, replace spaces with hyphens, limit length
  -- Keep only alphanumeric, hyphens, and underscores
  v_sanitized_card_id := regexp_replace(
    regexp_replace(p_card_id, '[^a-zA-Z0-9_-]', '', 'g'),
    '\s+', '-', 'g'
  );
  
  -- Limit card_id part to 50 characters to keep SKU reasonable
  if length(v_sanitized_card_id) > 50 then
    v_sanitized_card_id := left(v_sanitized_card_id, 50);
  end if;
  
  -- Construct SKU: PKM-{card_id}-{condition}-{variation}
  v_sku := 'PKM-' || v_sanitized_card_id || '-' || upper(p_condition) || '-' || upper(p_variation);
  
  -- Ensure SKU is not too long (some systems have SKU length limits)
  -- Limit to 100 characters total
  if length(v_sku) > 100 then
    -- Truncate card_id part further if needed
    v_sanitized_card_id := left(v_sanitized_card_id, 100 - length('PKM--' || upper(p_condition) || '-' || upper(p_variation)));
    v_sku := 'PKM-' || v_sanitized_card_id || '-' || upper(p_condition) || '-' || upper(p_variation);
  end if;
  
  return v_sku;
end;
$$;

-- 3) Create function to get or create SKU for a (card_id, condition, variation) combination
-- This ensures all lots with the same combination share the same SKU
create or replace function public.get_or_create_sku(
  p_card_id text,
  p_condition text,
  p_variation text
)
returns text
language plpgsql
as $$
declare
  v_sku text;
  v_existing_sku text;
begin
  -- Normalize variation (default to 'standard' if null)
  p_variation := coalesce(p_variation, 'standard');
  
  -- Check if a SKU already exists for this combination
  select distinct sku into v_existing_sku
  from public.inventory_lots
  where card_id = p_card_id
    and condition = p_condition
    and coalesce(variation, 'standard') = p_variation
    and sku is not null
  limit 1;
  
  if v_existing_sku is not null then
    -- Use existing SKU
    return v_existing_sku;
  end if;
  
  -- Generate new SKU
  v_sku := public.generate_sku(p_card_id, p_condition, p_variation);
  
  return v_sku;
end;
$$;

-- 4) Create trigger function to automatically assign SKU on insert/update
create or replace function public.assign_sku_to_lot()
returns trigger
language plpgsql
as $$
begin
  -- Only assign SKU if it's not already set (allows manual override if needed)
  if NEW.sku is null then
    NEW.sku := public.get_or_create_sku(
      NEW.card_id,
      NEW.condition,
      coalesce(NEW.variation, 'standard')
    );
  end if;
  
  return NEW;
end;
$$;

-- 5) Create trigger to call assign_sku_to_lot before insert/update
drop trigger if exists trg_assign_sku_to_lot on public.inventory_lots;
create trigger trg_assign_sku_to_lot
before insert or update on public.inventory_lots
for each row execute function public.assign_sku_to_lot();

-- 6) Update commit_acquisition function to explicitly assign SKUs
create or replace function public.commit_acquisition(p_acquisition_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  r record;
  v_count int;
  v_inserted int := 0;
  v_updated int := 0;
  v_lot_id uuid;
  v_sku text;
begin
  -- lock acquisition row to avoid concurrent commits
  perform 1 from public.acquisitions where id = p_acquisition_id for update;

  select count(*) into v_count
  from public.intake_lines
  where acquisition_id = p_acquisition_id and status = 'draft';

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'message', 'No draft intake lines');
  end if;

  -- group draft intake lines by card/condition/variation/for_sale/price
  for r in
    select
      card_id,
      condition,
      coalesce(variation, 'standard') as variation,
      for_sale,
      list_price_pence,
      sum(quantity)::int as qty_sum
    from public.intake_lines
    where acquisition_id = p_acquisition_id and status = 'draft'
    group by card_id, condition, coalesce(variation, 'standard'), for_sale, list_price_pence
  loop
    -- Try to merge into an existing active lot with same attrs AND same acquisition_id
    -- This ensures we only merge lots from the same purchase
    -- Note: SKU will be assigned automatically by the trigger
    update public.inventory_lots
    set quantity = quantity + r.qty_sum, updated_at = now()
    where card_id = r.card_id
      and condition = r.condition
      and coalesce(variation, 'standard') = r.variation
      and for_sale = r.for_sale
      and acquisition_id = p_acquisition_id  -- CRITICAL: Only merge lots from the same purchase
      and (
        (list_price_pence is null and r.list_price_pence is null) or
        list_price_pence = r.list_price_pence
      )
      and status in ('draft','ready','listed')
    returning id into v_lot_id;

    if found then
      -- Update SKU to ensure consistency (trigger will handle if null)
      -- Get or create SKU and update if needed
      v_sku := public.get_or_create_sku(r.card_id, r.condition, r.variation);
      update public.inventory_lots
      set sku = v_sku
      where id = v_lot_id and (sku is null or sku != v_sku);
      
      v_updated := v_updated + 1;
    else
      -- No matching lot from same purchase found - create new lot
      -- SKU will be assigned automatically by the trigger
      insert into public.inventory_lots (
        card_id,
        condition,
        variation,
        quantity,
        for_sale,
        list_price_pence,
        status,
        acquisition_id
      )
      values (
        r.card_id,
        r.condition,
        r.variation,
        r.qty_sum,
        r.for_sale,
        r.list_price_pence,
        case when r.for_sale then 'ready' else 'draft' end::public.lot_status,
        p_acquisition_id
      )
      returning id into v_lot_id;

      v_inserted := v_inserted + 1;
    end if;
  end loop;

  -- mark intake lines as committed
  update public.intake_lines
  set status = 'committed'
  where acquisition_id = p_acquisition_id and status = 'draft';

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'updated', v_updated,
    'message', 'Committed intake lines'
  );
end;
$$;

-- 7) Backfill SKUs for existing inventory_lots
-- This ensures all existing lots get SKUs assigned
update public.inventory_lots
set sku = public.get_or_create_sku(
  card_id,
  condition,
  coalesce(variation, 'standard')
)
where sku is null;

-- 8) Make SKU not null after backfill (optional - can keep nullable if you want manual override capability)
-- We'll keep it nullable to allow manual overrides if needed, but the trigger will always assign one

-- 9) Add comment explaining the SKU field
comment on column public.inventory_lots.sku is 'Stock Keeping Unit (SKU) - Unique identifier for card+condition+variation combinations. All lots with the same card_id, condition, and variation share the same SKU.';

