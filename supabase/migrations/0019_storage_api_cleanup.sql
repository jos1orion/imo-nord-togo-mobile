-- Storage objects must be deleted through the Storage API, not by deleting
-- rows from storage.objects. Keep listing images intact when a listing expires
-- or becomes occupied; visibility remains controlled by RLS.
drop trigger if exists properties_cleanup_inactive_images on public.properties;
drop function if exists public.cleanup_inactive_property_images();

create or replace function public.expire_due_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  with expired as (
    update public.properties
       set listing_status = 'archived', featured = false
     where listing_status = 'approved'
       and status = 'available'
       and expires_at is not null
       and expires_at <= now()
     returning id, current_publication_id
  ), archived_publications as (
    update public.publications publication
       set status = 'archived', featured = false
      from expired
     where publication.id = expired.current_publication_id
        or publication.property_id = expired.id
    returning publication.id
  )
  select count(*) into affected from expired;

  return affected;
end;
$$;

revoke all on function public.expire_due_listings() from public, anon, authenticated;
grant execute on function public.expire_due_listings() to service_role;
