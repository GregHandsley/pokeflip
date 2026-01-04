-- Add unique constraint to ensure only one photo per bundle
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'bundle_photos_bundle_id_key'
  ) then
    alter table public.bundle_photos
    add constraint bundle_photos_bundle_id_key unique(bundle_id);
  end if;
end $$;

