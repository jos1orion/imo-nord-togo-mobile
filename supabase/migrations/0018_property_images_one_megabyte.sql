-- Apply the 1 MiB property-image limit to Supabase projects that already ran
-- the original storage-constraints migration.
update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'property-images';
