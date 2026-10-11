-- Let the properties_sync_publication trigger be the only path that archives
-- corresponding publications when properties expire.
begin;

create or replace function public.expire_due_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.properties
     set listing_status = 'archived', featured = false
   where listing_status = 'approved'
     and status = 'available'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_due_listings() from public, anon, authenticated;
grant execute on function public.expire_due_listings() to service_role;

commit;
