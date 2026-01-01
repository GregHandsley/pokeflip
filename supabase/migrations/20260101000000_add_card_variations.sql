-- Add variation tracking for inventory lots
-- Variations examples: standard, holo, reverse holo, first edition, master ball, stamped, promo, shadowless, non-holo

alter table public.inventory_lots
add column if not exists variation text not null default 'standard'
  check (variation in (
    'standard',
    'holo',
    'reverse_holo',
    'first_edition',
    'master_ball',
    'stamped',
    'promo',
    'shadowless',
    'non_holo'
  ));

create index if not exists idx_inventory_lots_variation on public.inventory_lots(variation);

-- Also track variation on intake_lines so acquisition flow captures it
alter table public.intake_lines
add column if not exists variation text not null default 'standard'
  check (variation in (
    'standard',
    'holo',
    'reverse_holo',
    'first_edition',
    'master_ball',
    'stamped',
    'promo',
    'shadowless',
    'non_holo'
  ));

