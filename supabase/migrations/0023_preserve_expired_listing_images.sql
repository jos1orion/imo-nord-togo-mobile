begin;

-- Keep archived listing photos available for agent renewals. Cancel work already
-- queued by the previous archive cleanup rule so it cannot remove these photos.
update public.property_storage_cleanup_jobs
   set status = 'completed',
       image_urls = '{}',
       processing_at = null,
       completed_at = coalesce(completed_at, now()),
       last_error = null
  from public.properties property
 where property.id = property_storage_cleanup_jobs.property_id
   and property.status <> 'occupied'
   and property_storage_cleanup_jobs.status in ('pending', 'processing');

create or replace function public.queue_property_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'occupied' and old.status is distinct from 'occupied' then
    insert into public.property_storage_cleanup_jobs (property_id, image_urls)
    select new.id, coalesce(array_agg(image.url), '{}'::text[])
      from public.property_images image
     where image.property_id = new.id
    having count(*) > 0;
  end if;

  return new;
end;
$$;

drop policy if exists "properties_update_own_archived_renewal" on public.properties;
create policy "properties_update_own_archived_renewal" on public.properties
for update
using (
  owner_id = auth.uid()
  and listing_status = 'archived'
  and status = 'available'
  and exists (
    select 1
      from public.profiles profile
     where profile.id = auth.uid()
       and profile.account_status = 'active'
       and profile.role in ('ADMIN', 'AGENT')
       and (profile.role = 'ADMIN' or profile.agent_status = 'approved' or public.can_direct_publish_property())
  )
)
with check (
  owner_id = auth.uid()
  and status = 'available'
  and (
    listing_status = 'pending'
    or (
      listing_status = 'approved'
      and (public.is_admin() or public.can_direct_publish_property())
    )
  )
  and coalesce(featured, false) = false
  and exists (
    select 1
      from public.profiles profile
     where profile.id = auth.uid()
       and profile.account_status = 'active'
       and profile.role in ('ADMIN', 'AGENT')
       and (profile.role = 'ADMIN' or profile.agent_status = 'approved' or public.can_direct_publish_property())
  )
);

revoke all on function public.queue_property_storage_cleanup() from public, anon, authenticated;

commit;
