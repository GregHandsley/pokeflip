-- =========================
-- Add photo support for bundles
-- =========================

create table if not exists public.bundle_photos (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  kind text not null default 'bundle' check (kind in ('bundle')),
  object_key text not null,
  created_at timestamptz not null default now(),
  unique(bundle_id) -- Only one photo per bundle
);

create index if not exists idx_bundle_photos_bundle on public.bundle_photos(bundle_id);

