-- IMMO NORD TOGO — INSTALLATION SUPABASE COMPLETE
-- Execute this entire file once in the Supabase SQL Editor on a NEW project.
-- Do not execute admin/supabase/schema.sql or docs/supabase-production-migration.sql afterwards.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('USER', 'ADMIN', 'AGENT', 'ACCOUNTANT');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.property_type as enum ('house', 'land', 'apartment', 'shop');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.property_status as enum ('available', 'occupied');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.listing_status as enum ('pending', 'approved', 'rejected', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contract_status as enum ('active', 'expired');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_method as enum ('cash', 'mobile_money');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('paid', 'late', 'pending');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.tenant_document_type as enum ('cni', 'contract', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'USER',
  account_status text not null default 'active'
    constraint profiles_account_status_check check (account_status in ('active', 'suspended', 'pending')),
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete set null,
  title text not null,
  type public.property_type not null,
  price numeric not null check (price >= 0),
  location text not null,
  neighborhood text,
  description text,
  area numeric check (area is null or area >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  amenities text[] not null default '{}',
  client_id uuid references auth.users on delete set null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status public.property_status not null default 'available',
  listing_status public.listing_status not null default 'pending',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  sold_at timestamptz,
  rented_at timestamptz,
  featured_start_at timestamptz,
  featured_end_at timestamptz,
  republished_at timestamptz
);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.neighborhoods (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(), full_name text not null, phone text not null,
  email text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.tenant_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants on delete cascade,
  type public.tenant_document_type not null default 'cni', url text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(), property_id uuid references public.properties on delete restrict,
  tenant_id uuid references public.tenants on delete restrict, start_date date not null, end_date date not null,
  rent_amount numeric not null check (rent_amount >= 0), status public.contract_status not null default 'active',
  created_at timestamptz not null default now(), check (end_date >= start_date)
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), contract_id uuid references public.contracts on delete cascade,
  amount numeric not null check (amount >= 0), paid_at date not null,
  method public.payment_method not null default 'cash', status public.payment_status not null default 'paid',
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  type text not null default 'rappel', read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid, actor_name text, action text not null,
  entity text not null, entity_id uuid, created_at timestamptz not null default now()
);
create table if not exists public.favorites (
  user_id uuid not null references auth.users on delete cascade,
  property_id uuid not null references public.properties on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, property_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users on delete cascade,
  receiver_id uuid not null references auth.users on delete cascade,
  property_id uuid references public.properties on delete set null,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  type text not null default 'text' check (type in ('text', 'image', 'property_link')),
  read boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.user_push_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null, updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('ADMIN', 'AGENT', 'ACCOUNTANT')
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create or replace function public.create_profile_for_auth_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.raw_user_meta_data ->> 'phone', 'USER')
  on conflict (id) do nothing;
  return new;
end;
$$;
create or replace function public.apply_property_lifecycle() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.submitted_at := coalesce(new.submitted_at, now());
    if new.featured then new.featured_start_at := now(); new.featured_end_at := now() + interval '7 days'; end if;
  elsif new.listing_status = 'approved' and old.listing_status is distinct from 'approved' then
    new.approved_at := coalesce(new.approved_at, now()); new.published_at := now();
    new.expires_at := now() + interval '30 days';
    new.republished_at := case when old.published_at is null then null else now() end;
  elsif new.featured and not coalesce(old.featured, false) then
    new.featured_start_at := now(); new.featured_end_at := now() + interval '7 days';
  elsif not new.featured and coalesce(old.featured, false) then
    new.featured_end_at := now();
  end if;
  return new;
end;
$$;
create or replace function public.cleanup_inactive_property_images() returns trigger language plpgsql security definer set search_path = public, storage as $$
begin
  if old.status = 'available' and new.status = 'occupied' then
    delete from storage.objects where bucket_id = 'property-images' and name like new.owner_id::text || '/' || new.id::text || '/%';
    delete from public.property_images where property_id = new.id;
  end if;
  return new;
end;
$$;
create or replace function public.expire_due_listings() returns integer language plpgsql security definer set search_path = public, storage as $$
declare affected integer;
begin
  with expired as (
    update public.properties set listing_status = 'archived', featured = false
    where listing_status = 'approved' and status = 'available' and expires_at <= now()
    returning id, owner_id
  ), deleted_images as (
    delete from public.property_images i using expired e where i.property_id = e.id returning e.owner_id, e.id
  )
  delete from storage.objects o using deleted_images d
  where o.bucket_id = 'property-images' and o.name like d.owner_id::text || '/' || d.id::text || '/%';
  get diagnostics affected = row_count; return affected;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_auth_user();
drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists properties_apply_lifecycle on public.properties;
create trigger properties_apply_lifecycle before insert or update on public.properties for each row execute function public.apply_property_lifecycle();
drop trigger if exists properties_cleanup_inactive_images on public.properties;
create trigger properties_cleanup_inactive_images after update on public.properties for each row execute function public.cleanup_inactive_property_images();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_documents enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.favorites enable row level security;
alter table public.messages enable row level security;
alter table public.user_push_tokens enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "properties_select_public_or_owner" on public.properties for select using (
  (listing_status = 'approved' and status = 'available' and (expires_at is null or expires_at > now()))
  or owner_id = auth.uid() or public.is_admin()
);
create policy "properties_insert_own_pending" on public.properties for insert with check (
  owner_id = auth.uid() and listing_status = 'pending' and coalesce(featured, false) = false
);
create policy "properties_update_own_private" on public.properties for update
using (owner_id = auth.uid() and listing_status in ('pending', 'rejected'))
with check (owner_id = auth.uid() and listing_status in ('pending', 'rejected') and coalesce(featured, false) = false);
create policy "properties_delete_own_private" on public.properties for delete using (owner_id = auth.uid() and listing_status in ('pending', 'rejected'));
create policy "properties_admin_all" on public.properties for all using (public.is_admin()) with check (public.is_admin());
create policy "property_images_select_visible" on public.property_images for select using (exists (
  select 1 from public.properties p where p.id = property_id and
  ((p.listing_status = 'approved' and p.status = 'available' and (p.expires_at is null or p.expires_at > now())) or p.owner_id = auth.uid() or public.is_admin())
));
create policy "property_images_insert_owner" on public.property_images for insert with check (exists (
  select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid() and p.listing_status in ('pending', 'rejected')
) or public.is_admin());
create policy "property_images_admin_delete" on public.property_images for delete using (public.is_admin());
create policy "neighborhoods_public_read" on public.neighborhoods for select using (true);
create policy "neighborhoods_admin_write" on public.neighborhoods for all using (public.is_admin()) with check (public.is_admin());
create policy "favorites_owner_all" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages_participants_read" on public.messages for select using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin());
create policy "messages_sender_insert" on public.messages for insert with check (sender_id = auth.uid());
create policy "messages_receiver_update" on public.messages for update using (receiver_id = auth.uid() or public.is_admin()) with check (receiver_id = auth.uid() or public.is_admin());
create policy "push_tokens_owner_all" on public.user_push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin_tenants" on public.tenants for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_tenant_documents" on public.tenant_documents for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_contracts" on public.contracts for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_payments" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_notifications" on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_activity_logs" on public.activity_logs for all using (public.is_admin()) with check (public.is_admin());

-- Create these buckets in Supabase Storage before uploads: property-images (public) and tenant-documents (private).
create policy "storage_property_images_public_read" on storage.objects for select using (bucket_id = 'property-images');
create policy "storage_property_images_owner_insert" on storage.objects for insert with check (
  bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "storage_property_images_owner_delete" on storage.objects for delete using (
  bucket_id = 'property-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- After the first administrator profile has been promoted manually:
-- update public.profiles set role = 'ADMIN' where id = '<uuid-auth>';
do $$
begin
  begin
    perform cron.unschedule('expire-imo-nord-listings');
  exception when others then
    null;
  end;
  perform cron.schedule('expire-imo-nord-listings', '5 0 * * *', $c$select public.expire_due_listings();$c$);
exception when others then
  raise notice 'pg_cron indisponible : activez l''extension puis planifiez expire_due_listings().';
end $$;
