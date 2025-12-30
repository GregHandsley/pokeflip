-- =========================
-- Auto-update lot status when items are sold
-- =========================

-- Function to update lot status based on sold quantity
create or replace function public.update_lot_status_on_sale()
returns trigger
language plpgsql
as $$
declare
  v_lot_id uuid;
  v_sold_qty int;
  v_lot_quantity int;
begin
  -- Get the lot_id from the sales_item (works for both INSERT and UPDATE)
  v_lot_id := coalesce(NEW.lot_id, OLD.lot_id);
  
  if v_lot_id is null then
    return coalesce(NEW, OLD);
  end if;

  -- Calculate total sold quantity for this lot
  select coalesce(sum(qty), 0)::int
  into v_sold_qty
  from public.sales_items
  where lot_id = v_lot_id;

  -- Get the lot's total quantity
  select quantity
  into v_lot_quantity
  from public.inventory_lots
  where id = v_lot_id;

  -- Update lot status based on sold quantity
  if v_sold_qty >= v_lot_quantity then
    -- All items sold - mark lot as sold
    update public.inventory_lots
    set status = 'sold'::public.lot_status
    where id = v_lot_id
      and status != 'sold';  -- Only update if not already sold (avoid unnecessary updates)
  elsif v_sold_qty = 0 then
    -- Nothing sold - ensure status is not 'sold' (revert if needed)
    -- Only revert if it was previously sold and now has no sales
    update public.inventory_lots
    set status = case 
      when status = 'sold' then 'ready'::public.lot_status
      else status
    end
    where id = v_lot_id
      and status = 'sold';
  end if;

  return coalesce(NEW, OLD);
end $$;

-- Create trigger on sales_items insert/update
drop trigger if exists trg_update_lot_status_on_sale_insert on public.sales_items;
create trigger trg_update_lot_status_on_sale_insert
after insert on public.sales_items
for each row execute function public.update_lot_status_on_sale();

-- Create trigger on sales_items update
drop trigger if exists trg_update_lot_status_on_sale_update on public.sales_items;
create trigger trg_update_lot_status_on_sale_update
after update on public.sales_items
for each row execute function public.update_lot_status_on_sale();

-- Create trigger on sales_items delete (in case sales are removed)
drop trigger if exists trg_update_lot_status_on_sale_delete on public.sales_items;
create trigger trg_update_lot_status_on_sale_delete
after delete on public.sales_items
for each row execute function public.update_lot_status_on_sale();

-- Also update existing lots that should be marked as sold
-- (for data consistency if there are existing sales)
update public.inventory_lots l
set status = 'sold'::public.lot_status
where l.status != 'sold'
  and exists (
    select 1
    from (
      select lot_id, sum(qty)::int as sold_qty
      from public.sales_items
      group by lot_id
    ) sold
    where sold.lot_id = l.id
      and sold.sold_qty >= l.quantity
  );

