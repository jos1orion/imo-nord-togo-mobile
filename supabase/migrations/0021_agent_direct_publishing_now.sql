-- Enable direct publishing for active agents from 2026-10-11 through 2027-06-01
-- inclusive (UTC). These additive policies preserve existing edit rules.
begin;

create or replace function public.can_direct_publish_property()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'AGENT'
      and profile.account_status = 'active'
      and now() >= timestamptz '2026-10-11 00:00:00+00'
      and now() < timestamptz '2027-06-02 00:00:00+00'
  );
$$;

revoke all on function public.can_direct_publish_property() from public;
grant execute on function public.can_direct_publish_property() to anon, authenticated, service_role;

drop policy if exists "properties_agent_direct_publish" on public.properties;
create policy "properties_agent_direct_publish" on public.properties
for insert with check (
  owner_id = auth.uid()
  and coalesce(featured, false) = false
  and listing_status = 'approved'
  and public.can_direct_publish_property()
);

drop policy if exists "properties_agent_direct_publish_update" on public.properties;
create policy "properties_agent_direct_publish_update" on public.properties
for update
using (
  owner_id = auth.uid()
  and listing_status in ('pending', 'rejected', 'approved')
  and public.can_direct_publish_property()
)
with check (
  owner_id = auth.uid()
  and coalesce(featured, false) = false
  and listing_status = 'approved'
  and public.can_direct_publish_property()
);

drop policy if exists "property_images_agent_direct_publish_insert" on public.property_images;
create policy "property_images_agent_direct_publish_insert" on public.property_images
for insert with check (
  exists (
    select 1
    from public.properties property
    where property.id = property_id
      and property.owner_id = auth.uid()
      and property.listing_status = 'approved'
      and public.can_direct_publish_property()
  )
);

drop policy if exists "storage_property_images_agent_direct_publish_insert" on storage.objects;
create policy "storage_property_images_agent_direct_publish_insert" on storage.objects
for insert with check (
  bucket_id = 'property-images'
  and exists (
    select 1
    from public.properties property
    where property.owner_id = auth.uid()
      and property.id::text = (storage.foldername(name))[2]
      and property.listing_status = 'approved'
      and public.can_direct_publish_property()
  )
);

commit;
