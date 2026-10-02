-- Repair missing columns used by the web back-office and mobile listings.
-- Run this from the Supabase SQL Editor on an existing production project.
begin;

alter table public.profiles
  add column if not exists account_status text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'suspended', 'pending'));
  end if;
end $$;

alter table public.properties add column if not exists city text;
alter table public.properties
  add column if not exists client_id uuid references auth.users(id) on delete set null;
alter table public.properties add column if not exists contact_name text;
alter table public.properties add column if not exists contact_phone text;
alter table public.properties add column if not exists contact_email text;

update public.properties
set city = coalesce(nullif(btrim(city), ''), location)
where nullif(btrim(city), '') is null;

update public.properties
set client_id = owner_id
where client_id is null and owner_id is not null;

update public.properties as listing
set
  contact_name = coalesce(nullif(btrim(listing.contact_name), ''), nullif(btrim(profile.full_name), '')),
  contact_phone = coalesce(nullif(btrim(listing.contact_phone), ''), nullif(btrim(profile.phone), '')),
  contact_email = coalesce(nullif(btrim(listing.contact_email), ''), nullif(btrim(auth_user.email), ''))
from public.profiles as profile
left join auth.users as auth_user on auth_user.id = profile.id
where profile.id = coalesce(listing.client_id, listing.owner_id)
  and (
    nullif(btrim(listing.contact_name), '') is null
    or nullif(btrim(listing.contact_phone), '') is null
    or nullif(btrim(listing.contact_email), '') is null
  );

commit;

notify pgrst, 'reload schema';
