-- =========================
-- Simplify lot creation - no splitting, preserve quantities
-- =========================

-- Update commit_acquisition function to create lots with actual quantities
-- One lot per intake line (no expansion)
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

  -- Create one lot per intake line, preserving the quantity
  -- Simple approach: one intake line = one lot with the same quantity
  insert into public.inventory_lots (card_id, condition, quantity, for_sale, list_price_pence, status, acquisition_id, note)
  select
    il.card_id,
    il.condition,
    il.quantity,  -- Use actual quantity from intake line
    il.for_sale,
    il.list_price_pence,
    'ready'::public.lot_status,
    p_acquisition_id,
    il.note
  from public.intake_lines il
  where il.acquisition_id = p_acquisition_id and il.status = 'draft';

  -- Mark intake lines as committed
  update public.intake_lines
  set status = 'committed'
  where acquisition_id = p_acquisition_id and status = 'draft';

  -- Transfer photos from intake lines to lots
  -- Match lots to intake lines by matching all fields (one-to-one mapping)
  insert into public.lot_photos (lot_id, kind, object_key)
  select distinct
    l.id as lot_id,
    ilp.kind,
    ilp.object_key
  from public.inventory_lots l
  inner join public.intake_lines il on
    il.acquisition_id = p_acquisition_id
    and il.card_id = l.card_id
    and il.condition = l.condition
    and il.quantity = l.quantity
    and il.for_sale = l.for_sale
    and ( (l.list_price_pence is null and il.list_price_pence is null)
          or (l.list_price_pence = il.list_price_pence) )
    and il.status = 'committed'
    and l.acquisition_id = p_acquisition_id
    and l.created_at >= now() - interval '1 minute'  -- Only match recently created lots
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

