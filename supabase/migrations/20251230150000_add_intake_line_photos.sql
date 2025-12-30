-- =========================
-- Add photo support for intake lines (draft cart)
-- =========================

-- 1) Create intake_line_photos table (similar to lot_photos)
create table if not exists public.intake_line_photos (
  id uuid primary key default gen_random_uuid(),
  intake_line_id uuid not null,
  kind text not null check (kind in ('front','back','extra')),
  object_key text not null,
  created_at timestamptz not null default now()
);

-- Add foreign key constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'intake_line_photos_intake_line_id_fkey'
  ) then
    alter table public.intake_line_photos
    add constraint intake_line_photos_intake_line_id_fkey
    foreign key (intake_line_id)
    references public.intake_lines(id)
    on delete cascade;
  end if;
end $$;

create index if not exists idx_intake_line_photos_line on public.intake_line_photos(intake_line_id);

-- 2) Update commit_acquisition function to transfer photos from intake lines to lots
--    When a lot is created or merged, copy photos from the intake lines that contributed to it
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
      sum(quantity)::int as qty_sum,
      array_agg(id) as intake_line_ids  -- Collect all intake line IDs that contribute to this group
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
    returning l.id, m.intake_line_ids
  ),
  ins as (
    insert into public.inventory_lots (card_id, condition, quantity, for_sale, list_price_pence, status, acquisition_id)
    select
      m.card_id, m.condition, m.qty_sum, m.for_sale, m.list_price_pence, 'ready'::public.lot_status, p_acquisition_id
    from matched m
    where m.lot_id is null
    returning id, card_id, condition, for_sale, list_price_pence
  ),
  -- Map new lots to their intake line IDs by matching on the grouping key
  ins_with_lines as (
    select 
      i.id as lot_id,
      m.intake_line_ids
    from ins i
    inner join matched m on 
      i.card_id = m.card_id
      and i.condition = m.condition
      and i.for_sale = m.for_sale
      and ( (i.list_price_pence is null and m.list_price_pence is null)
            or (i.list_price_pence = m.list_price_pence) )
      and m.lot_id is null
  )
  -- Mark intake lines as committed first
  update public.intake_lines
  set status = 'committed'
  where acquisition_id = p_acquisition_id and status = 'draft';

  -- Transfer photos from intake lines to lots
  -- Match lots to intake lines by the same grouping key used for lot creation
  insert into public.lot_photos (lot_id, kind, object_key)
  select distinct
    l.id as lot_id,
    ilp.kind,
    ilp.object_key
  from public.inventory_lots l
  inner join public.intake_lines il on
    l.card_id = il.card_id
    and l.condition = il.condition
    and l.for_sale = il.for_sale
    and ( (l.list_price_pence is null and il.list_price_pence is null)
          or (l.list_price_pence = il.list_price_pence) )
    and il.acquisition_id = p_acquisition_id
    and il.status = 'committed'
    and (l.acquisition_id = p_acquisition_id or l.status in ('draft','ready','listed'))
  inner join public.intake_line_photos ilp on ilp.intake_line_id = il.id
  where not exists (
    -- Avoid duplicates by checking if this photo already exists for this lot
    select 1 from public.lot_photos lp
    where lp.lot_id = l.id
      and lp.kind = ilp.kind
      and lp.object_key = ilp.object_key
  );

  return jsonb_build_object('ok', true, 'message', 'Committed intake lines', 'draft_lines_committed', v_count);
end $$;

grant execute on function public.commit_acquisition(uuid) to authenticated;

