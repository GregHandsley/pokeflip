-- Track which purchase (acquisition) created each inventory lot
-- This allows tracing lots back to their source purchase

-- Add acquisition_id to inventory_lots (nullable for existing lots)
alter table public.inventory_lots
add column if not exists acquisition_id uuid references public.acquisitions(id) on delete set null;

create index if not exists idx_lots_acquisition on public.inventory_lots(acquisition_id);

-- Update commit_acquisition function to record acquisition_id when creating lots
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
  -- Note: When merging into existing lots, we keep the original acquisition_id.
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
      l.quantity as lot_qty,
      l.acquisition_id as existing_acquisition_id
    from grouped g
    left join lateral (
      select id, quantity, acquisition_id
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
    insert into public.inventory_lots (card_id, condition, quantity, for_sale, list_price_pence, status, acquisition_id)
    select
      m.card_id, m.condition, m.qty_sum, m.for_sale, m.list_price_pence, 'ready'::public.lot_status, p_acquisition_id
    from matched m
    where m.lot_id is null
    returning id
  )
  update public.intake_lines
  set status = 'committed'
  where acquisition_id = p_acquisition_id and status = 'draft';

  return jsonb_build_object('ok', true, 'message', 'Committed intake lines', 'draft_lines_committed', v_count);
end $$;

