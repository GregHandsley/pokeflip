-- =========================
-- Add item_number field to inventory_lots for grouping
-- =========================

-- Add item_number column (nullable text field)
alter table public.inventory_lots
add column if not exists item_number text;

-- Create index for efficient lookups by item_number
create index if not exists idx_lots_item_number on public.inventory_lots(item_number) where item_number is not null;

-- Add comment explaining the field
comment on column public.inventory_lots.item_number is 'Item number for grouping lots together when marking as sold. Lots with the same item_number will be grouped together.';

