-- Fix foreign key constraints to cascade delete when cards are deleted
-- This allows deleting cards directly from the database

-- Fix intake_lines constraint
alter table public.intake_lines
drop constraint if exists intake_lines_card_id_fkey;

alter table public.intake_lines
add constraint intake_lines_card_id_fkey
foreign key (card_id)
references public.cards(id)
on delete cascade;

-- Fix inventory_lots constraint (change from restrict to cascade)
alter table public.inventory_lots
drop constraint if exists inventory_lots_card_id_fkey;

alter table public.inventory_lots
add constraint inventory_lots_card_id_fkey
foreign key (card_id)
references public.cards(id)
on delete cascade;

