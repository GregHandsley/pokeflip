-- Fix inventory_lots foreign key constraint to cascade delete when cards are deleted
-- This allows deleting cards directly from the database

alter table public.inventory_lots
drop constraint if exists inventory_lots_card_id_fkey;

alter table public.inventory_lots
add constraint inventory_lots_card_id_fkey
foreign key (card_id)
references public.cards(id)
on delete cascade;

