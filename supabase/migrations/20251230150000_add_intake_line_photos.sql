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

  -- Create a separate lot for each individual card (not grouped)
  -- If an intake line has quantity > 1, create multiple lots (one per card)
  -- This allows each card to be traced back to its specific purchase and managed individually
  with intake_line_expanded as (
    -- Expand each intake line into individual cards using generate_series
    select
      il.id as intake_line_id,
      il.card_id,
      il.condition,
      1 as quantity,  -- Each lot is for a single card
      il.for_sale,
      il.list_price_pence,
      il.note,
      row_number() over (partition by il.id order by il.id) as card_index
    from public.intake_lines il
    cross join lateral generate_series(1, il.quantity) as card_num
    where il.acquisition_id = p_acquisition_id and il.status = 'draft'
  ),
  ins as (
    insert into public.inventory_lots (card_id, condition, quantity, for_sale, list_price_pence, status, acquisition_id, note)
    select
      ile.card_id,
      ile.condition,
      1,  -- Always quantity 1 per lot
      ile.for_sale,
      ile.list_price_pence,
      'ready'::public.lot_status,
      p_acquisition_id,
      ile.note
    from intake_line_expanded ile
    returning id, card_id, condition, for_sale, list_price_pence
  )
  -- Mark intake lines as committed
  update public.intake_lines
  set status = 'committed'
  where acquisition_id = p_acquisition_id and status = 'draft';

  -- Transfer photos from intake lines to lots
  -- Since we create one lot per card, we need to match lots to their source intake lines
  -- Each lot gets photos from its source intake line (photos are shared across cards from the same intake line)
  insert into public.lot_photos (lot_id, kind, object_key)
  select distinct
    l.id as lot_id,
    ilp.kind,
    ilp.object_key
  from public.inventory_lots l
  inner join public.intake_lines il on
    l.acquisition_id = il.acquisition_id
    and l.card_id = il.card_id
    and l.condition = il.condition
    and l.for_sale = il.for_sale
    and ( (l.list_price_pence is null and il.list_price_pence is null)
          or (l.list_price_pence = il.list_price_pence) )
    and il.acquisition_id = p_acquisition_id
    and il.status = 'committed'
    and l.acquisition_id = p_acquisition_id
    and l.quantity = 1  -- All lots created in this function have quantity 1
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

