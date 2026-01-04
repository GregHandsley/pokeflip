-- =========================
-- Track multiple purchases per lot (for merged lots)
-- =========================

-- Create junction table to track which purchases contributed to a lot
create table if not exists public.lot_purchase_history (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.inventory_lots(id) on delete cascade,
  acquisition_id uuid not null references public.acquisitions(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(lot_id, acquisition_id)
);

create index if not exists idx_lot_purchase_history_lot on public.lot_purchase_history(lot_id);
create index if not exists idx_lot_purchase_history_acquisition on public.lot_purchase_history(acquisition_id);

-- Migrate existing data: create history entries for all existing lots with acquisition_id
insert into public.lot_purchase_history (lot_id, acquisition_id, quantity)
select id, acquisition_id, quantity
from public.inventory_lots
where acquisition_id is not null
on conflict (lot_id, acquisition_id) do nothing;

-- Add trigger to auto-create history entry when a lot is created with acquisition_id
create or replace function public.auto_create_lot_purchase_history()
returns trigger
language plpgsql
as $$
begin
  if NEW.acquisition_id is not null then
    insert into public.lot_purchase_history (lot_id, acquisition_id, quantity)
    values (NEW.id, NEW.acquisition_id, NEW.quantity)
    on conflict (lot_id, acquisition_id) do update
    set quantity = public.lot_purchase_history.quantity + NEW.quantity;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auto_create_lot_purchase_history on public.inventory_lots;
create trigger trg_auto_create_lot_purchase_history
after insert on public.inventory_lots
for each row execute function public.auto_create_lot_purchase_history();

