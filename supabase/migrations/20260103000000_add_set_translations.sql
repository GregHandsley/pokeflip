-- Add set translations table for English display names
-- This allows us to layer English names on top of TCGdex Japanese/Chinese set names

create table if not exists public.set_translations (
  set_id text primary key references public.sets(id) on delete cascade,
  name_en text not null,
  source text default 'manual', -- 'manual', 'translated', 'override'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_set_translations_set_id on public.set_translations(set_id);

-- Add trigger to update updated_at
create or replace function update_set_translations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_translations_updated_at
  before update on public.set_translations
  for each row
  execute function update_set_translations_updated_at();

-- Initial overrides will be inserted when sets are created via the API
-- No need to insert here as sets may not exist yet

