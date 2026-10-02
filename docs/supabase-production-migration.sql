-- Imo Nord Togo - migration de securite et cycle de vie des annonces.
-- A executer dans le SQL Editor Supabase APRES docs/supabase-user-role.sql
-- (le type user_role doit deja contenir USER).
-- Cette migration conserve les annonces et leur historique ; elle ne supprime pas de biens.
--
-- Ensuite, promouvoir un administrateur :
--   update public.profiles set role = 'ADMIN' where id = '<uuid-auth>';

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role' and e.enumlabel = 'USER'
  ) then
    raise exception 'Executez d''abord docs/supabase-user-role.sql, validez, puis relancez cette migration.';
  end if;
end $$;

-- Marketplace accounts are USER. Staff roles are ADMIN, AGENT, ACCOUNTANT only.
alter table public.profiles alter column role set default 'USER';

-- Every authenticated user receives the least-privileged role. The web API uses
-- UPSERT, so this trigger cannot conflict with an administrator-created account.
create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'phone',
    'USER'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- Backfill profiles for accounts already present in the existing project.
insert into public.profiles (id, full_name, phone, role)
select u.id, coalesce(u.raw_user_meta_data ->> 'name', u.email), u.raw_user_meta_data ->> 'phone', 'USER'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

alter table public.properties
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists sold_at timestamptz,
  add column if not exists rented_at timestamptz,
  add column if not exists featured_start_at timestamptz,
  add column if not exists featured_end_at timestamptz,
  add column if not exists republished_at timestamptz;

-- Old approved listings stay visible for 30 days from migration; pending/rejected
-- listings remain private. Adjust expires_at manually for imported historical data.
update public.properties
set submitted_at = coalesce(submitted_at, created_at)
where submitted_at is null;

update public.properties
set approved_at = coalesce(approved_at, created_at),
    published_at = coalesce(published_at, created_at),
    expires_at = coalesce(expires_at, created_at + interval '30 days')
where listing_status = 'approved';

alter table public.profiles
  add column if not exists account_status text not null default 'active';

do $$ begin
  alter table public.profiles
    add constraint profiles_account_status_check
    check (account_status in ('active', 'suspended', 'pending'));
exception when duplicate_object then null;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('ADMIN', 'AGENT', 'ACCOUNTANT')
      and coalesce(account_status, 'active') <> 'suspended'
  );
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
  end if;

  if tg_op = 'UPDATE' and new.listing_status = 'approved'
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

drop trigger if exists properties_apply_lifecycle on public.properties;
create trigger properties_apply_lifecycle
before insert or update on public.properties
for each row execute function public.apply_property_lifecycle();

-- The client must never update occupancy directly.  The function verifies
-- ownership (including AGENT ownership) and maintains lifecycle timestamps.
create or replace function public.set_property_occupancy(
  p_property_id uuid,
  p_status public.property_status
)
returns public.properties
language plpgsql
security definer
set search_path = public
as $$
declare updated_property public.properties;
begin
  if p_status not in ('available', 'occupied') then
    raise exception 'Statut d''occupation invalide';
  end if;

  update public.properties
     set status = p_status,
         sold_at = case when p_status = 'occupied' then now() else null end,
         rented_at = case when p_status = 'occupied' then now() else null end
   where id = p_property_id
     and (owner_id = auth.uid() or public.is_admin())
  returning * into updated_property;

  if updated_property.id is null then
    raise exception 'Bien introuvable ou accès refusé';
  end if;
  return updated_property;
end;
$$;

-- Called by a Supabase scheduled Edge Function / cron once a day. Public RLS also
-- checks expires_at, so a late scheduled run can never expose an expired listing.
create or replace function public.expire_due_listings()
returns integer
language plpgsql
security definer
set search_path = public, storage
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
     returning id, owner_id
  ), removed_images as (
    delete from public.property_images images
    using expired
    where images.property_id = expired.id
    returning expired.owner_id, expired.id
  )
  delete from storage.objects object
  using removed_images
  where object.bucket_id = 'property-images'
    and object.name like removed_images.owner_id::text || '/' || removed_images.id::text || '/%';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- The same cleanup happens immediately when an available listing is marked occupied.
create or replace function public.cleanup_inactive_property_images()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if old.status = 'available' and new.status = 'occupied' then
    delete from storage.objects
      where bucket_id = 'property-images'
        and name like new.owner_id::text || '/' || new.id::text || '/%';
    delete from public.property_images where property_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_cleanup_inactive_images on public.properties;
create trigger properties_cleanup_inactive_images
after update on public.properties
for each row execute function public.cleanup_inactive_property_images();

-- Tables used by the mobile application but absent from the original back-office schema.
create table if not exists public.favorites (
  user_id uuid not null references auth.users on delete cascade,
  property_id uuid not null references public.properties on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users on delete cascade,
  receiver_id uuid not null references auth.users on delete cascade,
  property_id uuid references public.properties on delete set null,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  type text not null default 'text' check (type in ('text', 'image', 'property_link')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_push_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.favorites enable row level security;
alter table public.messages enable row level security;
alter table public.user_push_tokens enable row level security;

-- Replace permissive/conflicting policies. Drops include names from a previous
-- run of this file so the script is safe to re-execute.
drop policy if exists "Properties read" on public.properties;
drop policy if exists "Properties insert own" on public.properties;
drop policy if exists "Properties update own" on public.properties;
drop policy if exists "Properties delete own" on public.properties;
drop policy if exists "properties_select_public_approved" on public.properties;
drop policy if exists "properties_select_public_or_owner" on public.properties;
drop policy if exists "properties_insert_own_pending" on public.properties;
drop policy if exists "properties_update_own_private" on public.properties;
drop policy if exists "properties_delete_own_private" on public.properties;
drop policy if exists "properties_admin_all" on public.properties;

create policy "properties_select_public_or_owner" on public.properties for select using (
  (listing_status = 'approved' and status = 'available' and (expires_at is null or expires_at > now()))
  or owner_id = auth.uid()
  or public.is_admin()
);

create policy "properties_insert_own_pending" on public.properties for insert with check (
  auth.uid() = owner_id and listing_status = 'pending' and coalesce(featured, false) = false
);

-- Marketplace users and AGENT staff can only correct their own private
-- pending/rejected listings. Approval, publication and featured state stay
-- exclusively under ADMIN control.
create policy "properties_update_own_private" on public.properties for update
using (owner_id = auth.uid() and listing_status in ('pending', 'rejected'))
with check (owner_id = auth.uid() and listing_status in ('pending', 'rejected') and coalesce(featured, false) = false);

create policy "properties_delete_own_private" on public.properties for delete
using (owner_id = auth.uid() and listing_status in ('pending', 'rejected'));

create policy "properties_admin_all" on public.properties for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Property images read" on public.property_images;
drop policy if exists "Property images insert own" on public.property_images;
drop policy if exists "Property images update own" on public.property_images;
drop policy if exists "Property images delete own" on public.property_images;
drop policy if exists "property_images_select_public" on public.property_images;
drop policy if exists "property_images_select_visible" on public.property_images;
drop policy if exists "property_images_select_visible_property" on public.property_images;
drop policy if exists "property_images_insert_owner" on public.property_images;
drop policy if exists "property_images_admin_delete" on public.property_images;
drop policy if exists "property_images_admin_all" on public.property_images;

create policy "property_images_select_visible_property" on public.property_images for select using (
  exists (select 1 from public.properties p where p.id = property_id and
    ((p.listing_status = 'approved' and p.status = 'available' and (p.expires_at is null or p.expires_at > now()))
     or p.owner_id = auth.uid() or public.is_admin()))
);
create policy "property_images_insert_owner" on public.property_images for insert with check (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()
    and p.listing_status in ('pending', 'rejected')) or public.is_admin()
);
create policy "property_images_admin_delete" on public.property_images for delete using (public.is_admin());

drop policy if exists "favorites_owner_rw" on public.favorites;
create policy "favorites_owner_rw" on public.favorites for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "messages_participants_select" on public.messages;
drop policy if exists "messages_participants_read" on public.messages;
drop policy if exists "messages_sender_insert" on public.messages;
drop policy if exists "messages_participants_update" on public.messages;
drop policy if exists "messages_receiver_mark_read" on public.messages;
drop policy if exists "messages_receiver_update" on public.messages;
create policy "messages_participants_select" on public.messages for select
using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin());
create policy "messages_sender_insert" on public.messages for insert with check (sender_id = auth.uid());
create policy "messages_receiver_mark_read" on public.messages for update
using (receiver_id = auth.uid() or public.is_admin())
with check (receiver_id = auth.uid() or public.is_admin());

drop policy if exists "push_tokens_owner_all" on public.user_push_tokens;
create policy "push_tokens_owner_all" on public.user_push_tokens for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Remove old authenticated-user-wide access to private operational data.
drop policy if exists "Neighborhoods read" on public.neighborhoods;
drop policy if exists "Neighborhoods write" on public.neighborhoods;
drop policy if exists "neighborhoods_public_select" on public.neighborhoods;
drop policy if exists "neighborhoods_public_read" on public.neighborhoods;
drop policy if exists "neighborhoods_admin_all" on public.neighborhoods;
drop policy if exists "neighborhoods_admin_write" on public.neighborhoods;
create policy "neighborhoods_public_read" on public.neighborhoods for select using (true);
create policy "neighborhoods_admin_write" on public.neighborhoods for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Tenants read" on public.tenants;
drop policy if exists "Tenants write" on public.tenants;
drop policy if exists "tenants_admin_all" on public.tenants;
create policy "tenants_admin_all" on public.tenants for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Tenant docs read" on public.tenant_documents;
drop policy if exists "Tenant docs write" on public.tenant_documents;
drop policy if exists "tenant_documents_admin_all" on public.tenant_documents;
create policy "tenant_documents_admin_all" on public.tenant_documents for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Contracts read" on public.contracts;
drop policy if exists "Contracts write" on public.contracts;
drop policy if exists "contracts_admin_all" on public.contracts;
create policy "contracts_admin_all" on public.contracts for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Payments read" on public.payments;
drop policy if exists "Payments write" on public.payments;
drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Notifications read" on public.notifications;
drop policy if exists "Notifications write" on public.notifications;
create policy "notifications_admin_all" on public.notifications for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Logs read" on public.activity_logs;
drop policy if exists "Logs write" on public.activity_logs;
create policy "activity_logs_admin_all" on public.activity_logs for all
using (public.is_admin()) with check (public.is_admin());

-- Storage write access follows the authenticated owner folder: owner-id/property-id/file.
drop policy if exists "storage_property_images_admin_all" on storage.objects;
drop policy if exists "Property images read public" on storage.objects;
drop policy if exists "storage_property_images_public_read" on storage.objects;
drop policy if exists "storage_property_images_owner_insert" on storage.objects;
drop policy if exists "storage_property_images_owner_delete" on storage.objects;
create policy "storage_property_images_owner_insert" on storage.objects for insert with check (
  bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "storage_property_images_owner_delete" on storage.objects for delete using (
  bucket_id = 'property-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- Tenant files are always private: only an administrator may create/read them.
-- Store the object path in tenant_documents.url and issue short-lived signed URLs
-- at display time; do not store getPublicUrl() values for this bucket.
drop policy if exists "tenant_documents_storage_admin_all" on storage.objects;
create policy "tenant_documents_storage_admin_all" on storage.objects for all
using (bucket_id = 'tenant-documents' and public.is_admin())
with check (bucket_id = 'tenant-documents' and public.is_admin());

-- Former marketplace signups received AGENT. Run once when USER does not exist yet
-- so a later replay of this file cannot demote staff agents created afterwards.
do $$
begin
  if not exists (select 1 from public.profiles where role = 'USER') then
    update public.profiles set role = 'USER' where role = 'AGENT';
  end if;
end $$;

-- Daily expiry. No-op with a notice if pg_cron is not enabled.
do $$
begin
  begin
    perform cron.unschedule('expire-imo-nord-listings');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'expire-imo-nord-listings',
    '5 0 * * *',
    $c$select public.expire_due_listings();$c$
  );
exception when others then
  raise notice 'pg_cron indisponible : activez l''extension puis executez : select cron.schedule(''expire-imo-nord-listings'', ''5 0 * * *'', ''select public.expire_due_listings();'');';
end $$;
