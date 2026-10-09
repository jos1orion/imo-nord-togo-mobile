-- Temporary direct publishing for authenticated, active accounts through
-- 2027-04-07 (UTC). Existing agent approval requirements resume automatically
-- at 2027-04-08 00:00 UTC. Run this once in the Supabase SQL Editor.

begin;

alter table public.profiles
  add column if not exists agent_status text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_agent_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_agent_status_check
      check (agent_status in ('none', 'pending', 'approved', 'rejected'));
  end if;
end
$$;

create or replace function public.apply_property_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.submitted_at := coalesce(new.submitted_at, now());
    if new.listing_status = 'approved' then
      new.approved_at := coalesce(new.approved_at, now());
      new.published_at := coalesce(new.published_at, now());
      new.expires_at := coalesce(new.expires_at, now() + interval '30 days');
    end if;
  elsif new.listing_status = 'approved'
     and old.listing_status is distinct from 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.published_at := now();
    new.expires_at := now() + interval '30 days';
    new.republished_at := case when old.published_at is null then null else now() end;
  end if;

  if tg_op = 'INSERT' then
    if new.featured then
      new.featured_start_at := now();
      new.featured_end_at := now() + interval '7 days';
    end if;
  elsif new.featured and not coalesce(old.featured, false) then
    new.featured_start_at := now();
    new.featured_end_at := now() + interval '7 days';
  elsif not new.featured and coalesce(old.featured, false) then
    new.featured_end_at := now();
  end if;

  return new;
end;
$$;

drop policy if exists "Properties write" on public.properties;
drop policy if exists "Properties insert own" on public.properties;
drop policy if exists "properties_insert_owner_or_admin" on public.properties;
drop policy if exists "properties_insert_own_pending" on public.properties;
create policy "properties_insert_own_pending" on public.properties
for insert with check (
  owner_id = auth.uid()
  and coalesce(featured, false) = false
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_status = 'active'
      and (
        (
          now() < timestamptz '2027-04-08 00:00:00+00'
          and listing_status = 'approved'
        )
        or (
          now() >= timestamptz '2027-04-08 00:00:00+00'
          and profile.role in ('ADMIN', 'AGENT')
          and (profile.role = 'ADMIN' or profile.agent_status = 'approved')
          and listing_status = 'pending'
        )
      )
  )
);

drop policy if exists "Properties write" on public.properties;
drop policy if exists "Properties update own" on public.properties;
drop policy if exists "properties_update_owner_or_admin" on public.properties;
drop policy if exists "properties_update_own_private" on public.properties;
create policy "properties_update_own_private" on public.properties
for update
using (
  owner_id = auth.uid()
  and (
    listing_status in ('pending', 'rejected')
    or (
      listing_status = 'approved'
      and now() < timestamptz '2027-04-08 00:00:00+00'
      and exists (
        select 1 from public.profiles profile
        where profile.id = auth.uid() and profile.account_status = 'active'
      )
    )
  )
)
with check (
  owner_id = auth.uid()
  and coalesce(featured, false) = false
  and (
    listing_status in ('pending', 'rejected')
    or (
      listing_status = 'approved'
      and now() < timestamptz '2027-04-08 00:00:00+00'
      and exists (
        select 1 from public.profiles profile
        where profile.id = auth.uid() and profile.account_status = 'active'
      )
    )
  )
);

drop policy if exists "Properties write" on public.properties;
drop policy if exists "Properties delete own" on public.properties;
drop policy if exists "properties_delete_owner_or_admin" on public.properties;
drop policy if exists "properties_delete_own_private" on public.properties;
create policy "properties_delete_own_private" on public.properties
for delete using (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and (
      listing_status in ('pending', 'rejected')
      or (
        listing_status = 'approved'
        and now() < timestamptz '2027-04-08 00:00:00+00'
        and created_at > now() - interval '10 minutes'
      )
    )
  )
);

drop policy if exists "Property images write" on public.property_images;
drop policy if exists "Property images insert own" on public.property_images;
drop policy if exists "Property images update own" on public.property_images;
drop policy if exists "property_images_insert_owner" on public.property_images;
create policy "property_images_insert_owner" on public.property_images
for insert with check (
  public.is_admin()
  or exists (
    select 1
    from public.properties p
    join public.profiles profile on profile.id = p.owner_id
    where p.id = property_id
      and p.owner_id = auth.uid()
      and profile.account_status = 'active'
      and (
        (
          now() < timestamptz '2027-04-08 00:00:00+00'
          and p.listing_status = 'approved'
        )
        or (
          now() >= timestamptz '2027-04-08 00:00:00+00'
          and profile.role in ('ADMIN', 'AGENT')
          and (profile.role = 'ADMIN' or profile.agent_status = 'approved')
          and p.listing_status in ('pending', 'rejected')
        )
      )
  )
);

drop policy if exists "Property images write" on public.property_images;
drop policy if exists "Property images delete own" on public.property_images;
drop policy if exists "property_images_delete_owner" on public.property_images;
create policy "property_images_delete_owner" on public.property_images
for delete using (
  public.is_admin()
  or exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.owner_id = auth.uid()
      and p.listing_status = 'approved'
      and now() < timestamptz '2027-04-08 00:00:00+00'
      and p.created_at > now() - interval '10 minutes'
  )
);

drop policy if exists "Property images upload own" on storage.objects;
drop policy if exists "Property images update own" on storage.objects;
drop policy if exists "storage_property_images_owner_insert" on storage.objects;
create policy "storage_property_images_owner_insert" on storage.objects
for insert with check (
  bucket_id = 'property-images'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.properties p
      join public.profiles profile on profile.id = p.owner_id
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(name))[2]
        and profile.account_status = 'active'
        and (
          (
            now() < timestamptz '2027-04-08 00:00:00+00'
            and p.listing_status = 'approved'
          )
          or (
            now() >= timestamptz '2027-04-08 00:00:00+00'
            and profile.role in ('ADMIN', 'AGENT')
            and (profile.role = 'ADMIN' or profile.agent_status = 'approved')
            and p.listing_status in ('pending', 'rejected')
          )
        )
    )
  )
);

commit;
