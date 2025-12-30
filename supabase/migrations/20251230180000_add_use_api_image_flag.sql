-- =========================
-- Add flag to track if lot uses API image instead of uploaded photos
-- =========================

alter table public.inventory_lots
add column if not exists use_api_image boolean not null default false;

create index if not exists idx_lots_use_api_image on public.inventory_lots(use_api_image);

