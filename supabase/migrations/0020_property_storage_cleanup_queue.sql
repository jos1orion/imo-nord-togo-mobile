begin;

create table if not exists public.property_storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  image_urls text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  processing_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists property_storage_cleanup_jobs_pending_idx
  on public.property_storage_cleanup_jobs (created_at)
  where status = 'pending';

alter table public.property_storage_cleanup_jobs enable row level security;
revoke all on public.property_storage_cleanup_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.property_storage_cleanup_jobs to service_role;

create or replace function public.queue_property_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    (new.status = 'occupied' and old.status is distinct from 'occupied')
    or
    (new.listing_status = 'archived' and old.listing_status is distinct from 'archived')
  ) then
    insert into public.property_storage_cleanup_jobs (property_id, image_urls)
    select new.id, coalesce(array_agg(image.url), '{}'::text[])
      from public.property_images image
     where image.property_id = new.id
    having count(*) > 0;
  end if;

  return new;
end;
$$;

drop trigger if exists properties_queue_storage_cleanup on public.properties;
create trigger properties_queue_storage_cleanup
after update of status, listing_status on public.properties
for each row execute function public.queue_property_storage_cleanup();

revoke all on function public.queue_property_storage_cleanup() from public, anon, authenticated;

create or replace function public.claim_property_storage_cleanup_jobs(p_limit integer default 50)
returns table (id uuid, property_id uuid, image_urls text[], attempts integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select job.id
      from public.property_storage_cleanup_jobs job
     where job.status = 'pending'
        or (
          job.status = 'processing'
          and job.processing_at < now() - interval '15 minutes'
        )
     order by job.created_at
     limit least(greatest(coalesce(p_limit, 50), 1), 100)
     for update skip locked
  )
  update public.property_storage_cleanup_jobs job
     set status = 'processing',
         attempts = job.attempts + 1,
         processing_at = now(),
         last_error = null
    from candidates
   where job.id = candidates.id
  returning job.id, job.property_id, job.image_urls, job.attempts;
end;
$$;

revoke all on function public.claim_property_storage_cleanup_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_property_storage_cleanup_jobs(integer) to service_role;

commit;
