-- Create storage bucket for card photos (private bucket)
-- This bucket will store lot photos securely

-- Insert bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-photos',
  'card-photos',
  false, -- private bucket
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Set up RLS policies for the bucket
-- Allow authenticated users to upload photos
create policy "Users can upload photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'card-photos' AND
  (storage.foldername(name))[1] = 'lots'
);

-- Allow authenticated users to read photos (for signed URLs)
create policy "Users can read photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'card-photos');

-- Allow authenticated users to delete photos
create policy "Users can delete photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'card-photos');

