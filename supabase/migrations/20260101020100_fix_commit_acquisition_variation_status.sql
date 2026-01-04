-- Fix commit_acquisition: cast status to lot_status enum when inserting
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
    -- Try to merge into an existing active lot with same attrs
    update public.inventory_lots
    set quantity = quantity + r.qty_sum, updated_at = now()
    where card_id = r.card_id
      and condition = r.condition
      and coalesce(variation, 'standard') = r.variation
      and for_sale = r.for_sale
      and (
        (list_price_pence is null and r.list_price_pence is null) or
        list_price_pence = r.list_price_pence
      )
      and status in ('draft','ready','listed')
    returning id into v_lot_id;

    if found then
      v_updated := v_updated + 1;
    else
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
  set status = 'committed', updated_at = now()
  where acquisition_id = p_acquisition_id and status = 'draft';

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'updated', v_updated,
    'message', 'Committed intake lines'
  );
end;
$$;


