-- Fix bundle_photos kind constraint to allow 'bundle'
-- Drop existing constraint if it exists
do $$
begin
  -- Drop the old constraint if it exists
  if exists (
    select 1 from pg_constraint 
    where conname = 'bundle_photos_kind_check'
  ) then
    alter table public.bundle_photos
    drop constraint bundle_photos_kind_check;
  end if;
  
  -- Add the correct constraint
  alter table public.bundle_photos
  add constraint bundle_photos_kind_check check (kind in ('bundle'));
end $$;

