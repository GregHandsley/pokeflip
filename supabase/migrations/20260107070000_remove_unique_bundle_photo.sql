-- Remove unique constraint to allow multiple photos per bundle
do $$
begin
  if exists (
    select 1 from pg_constraint 
    where conname = 'bundle_photos_bundle_id_key'
  ) then
    alter table public.bundle_photos
    drop constraint bundle_photos_bundle_id_key;
  end if;
end $$;

