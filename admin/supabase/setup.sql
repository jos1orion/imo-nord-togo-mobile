-- Setup complet Supabase (schema + storage buckets + policies)
-- Execute ce script dans le SQL Editor de Supabase.

-- ====== SCHEMA ======
create type if not exists user_role as enum ('USER', 'ADMIN', 'AGENT', 'ACCOUNTANT');
create type if not exists property_type as enum ('house', 'land', 'apartment', 'shop');
create type if not exists property_status as enum ('available', 'occupied');
create type if not exists listing_status as enum ('pending', 'approved', 'rejected', 'archived');

do $$
begin
  alter type property_type add value if not exists 'shop';
exception
  when duplicate_object then null;
end $$;
create type if not exists contract_status as enum ('active', 'expired');
create type if not exists payment_method as enum ('cash', 'mobile_money');
create type if not exists payment_status as enum ('paid', 'late', 'pending');
create type if not exists tenant_document_type as enum ('cni', 'contract', 'other');

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'USER',
  created_at timestamptz not null default now()
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete set null,
  title text not null,
  type property_type not null,
  price numeric not null,
  location text not null,
  neighborhood text,
  description text,
  area numeric,
  bedrooms integer,
  bathrooms integer,
  amenities text[] not null default '{}',
  client_id uuid references auth.users on delete set null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status property_status not null default 'available',
  listing_status listing_status not null default 'pending',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants on delete cascade,
  type tenant_document_type not null default 'cni',
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties on delete restrict,
  tenant_id uuid references tenants on delete restrict,
  start_date date not null,
  end_date date not null,
  rent_amount numeric not null,
  status contract_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts on delete cascade,
  amount numeric not null,
  paid_at date not null,
  method payment_method not null default 'cash',
  status payment_status not null default 'paid',
  created_at timestamptz not null default now()
);

create table if not exists favorites (
  user_id uuid references auth.users on delete cascade,
  property_id uuid references properties on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users on delete cascade,
  receiver_id uuid references auth.users on delete cascade,
  property_id uuid references properties on delete set null,
  content text not null,
  type text not null default 'text',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists user_push_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'rappel',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists properties_updated_at on properties;
create trigger properties_updated_at
before update on properties
for each row execute procedure set_updated_at();

-- Ajout colonne owner_id si la table existe deja
alter table properties
  add column if not exists owner_id uuid references auth.users on delete set null;
alter table properties
  add column if not exists listing_status listing_status not null default 'pending';
alter table properties
  add column if not exists featured boolean not null default false;
alter table properties
  add column if not exists area numeric;
alter table properties
  add column if not exists bedrooms integer;
alter table properties
  add column if not exists bathrooms integer;
alter table properties
  add column if not exists amenities text[] not null default '{}';
alter table properties
  add column if not exists client_id uuid references auth.users on delete set null;
alter table properties
  add column if not exists contact_name text;
alter table properties
  add column if not exists contact_phone text;
alter table properties
  add column if not exists contact_email text;

update properties
set listing_status = 'approved'
where listing_status = 'pending' and owner_id is null;

-- Limite de 8 images par bien
create or replace function enforce_property_images_limit()
returns trigger as $$
declare
  img_count integer;
begin
  select count(*) into img_count
  from property_images
  where property_id = new.property_id;

  if img_count >= 8 then
    raise exception 'Maximum 8 images par bien';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists property_images_limit on property_images;
create trigger property_images_limit
before insert on property_images
for each row execute procedure enforce_property_images_limit();

-- ====== RLS ======
alter table profiles enable row level security;
alter table properties enable row level security;
alter table property_images enable row level security;
alter table neighborhoods enable row level security;
alter table tenants enable row level security;
alter table tenant_documents enable row level security;
alter table contracts enable row level security;
alter table payments enable row level security;
alter table favorites enable row level security;
alter table messages enable row level security;
alter table user_push_tokens enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;

create or replace function has_role(required_role user_role)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role = required_role
  );
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'
  );
$$;

drop policy if exists "Profiles read" on profiles;
drop policy if exists "Profiles write admin" on profiles;
drop policy if exists "Properties read" on properties;
drop policy if exists "Properties write" on properties;
drop policy if exists "Properties insert own" on properties;
drop policy if exists "Properties update own" on properties;
drop policy if exists "Properties delete own" on properties;
drop policy if exists "Property images read" on property_images;
drop policy if exists "Property images write" on property_images;
drop policy if exists "Property images insert own" on property_images;
drop policy if exists "Property images update own" on property_images;
drop policy if exists "Property images delete own" on property_images;
drop policy if exists "Tenants read" on tenants;
drop policy if exists "Tenants write" on tenants;
drop policy if exists "Tenant docs read" on tenant_documents;
drop policy if exists "Tenant docs write" on tenant_documents;
drop policy if exists "Contracts read" on contracts;
drop policy if exists "Contracts write" on contracts;
drop policy if exists "Payments read" on payments;
drop policy if exists "Payments write" on payments;
drop policy if exists "Favorites read" on favorites;
drop policy if exists "Favorites write" on favorites;
drop policy if exists "Messages read" on messages;
drop policy if exists "Messages insert" on messages;
drop policy if exists "Messages update" on messages;
drop policy if exists "Push tokens read" on user_push_tokens;
drop policy if exists "Push tokens write" on user_push_tokens;
drop policy if exists "Notifications read" on notifications;
drop policy if exists "Notifications write" on notifications;
drop policy if exists "Logs read" on activity_logs;
drop policy if exists "Logs write" on activity_logs;

create policy "Profiles read" on profiles for select
  using (auth.uid() = id or is_admin());

create policy "Profiles write admin" on profiles for all
  using (is_admin())
  with check (is_admin());

create policy "Properties read" on properties for select
  using (true);
create policy "Properties insert own" on properties for insert
  with check (
    (
      auth.role() = 'authenticated'
      and auth.uid() = owner_id
      and listing_status = 'pending'
    )
    or is_admin()
  );
create policy "Properties update own" on properties for update
  using (auth.uid() = owner_id or is_admin() or has_role('AGENT'))
  with check (auth.uid() = owner_id or is_admin() or has_role('AGENT'));
create policy "Properties delete own" on properties for delete
  using (auth.uid() = owner_id or is_admin() or has_role('AGENT'));

create policy "Property images read" on property_images for select
  using (true);
create policy "Property images insert own" on property_images for insert
  with check (
    (
      auth.role() = 'authenticated'
      and exists (
        select 1 from properties p
        where p.id = property_images.property_id
          and p.owner_id = auth.uid()
      )
    )
    or is_admin()
  );
create policy "Property images update own" on property_images for update
  using (
    exists (
      select 1 from properties p
      where p.id = property_images.property_id
        and p.owner_id = auth.uid()
    )
    or is_admin()
    or has_role('AGENT')
  )
  with check (
    exists (
      select 1 from properties p
      where p.id = property_images.property_id
        and p.owner_id = auth.uid()
    )
    or is_admin()
    or has_role('AGENT')
  );
create policy "Property images delete own" on property_images for delete
  using (
    exists (
      select 1 from properties p
      where p.id = property_images.property_id
        and p.owner_id = auth.uid()
    )
    or is_admin()
    or has_role('AGENT')
  );

create policy "Neighborhoods read" on neighborhoods for select
  using (auth.role() = 'authenticated');
create policy "Neighborhoods write" on neighborhoods for all
  using (is_admin() or has_role('AGENT'))
  with check (is_admin() or has_role('AGENT'));

create policy "Tenants read" on tenants for select
  using (auth.role() = 'authenticated');
create policy "Tenants write" on tenants for all
  using (is_admin() or has_role('AGENT'))
  with check (is_admin() or has_role('AGENT'));

create policy "Tenant docs read" on tenant_documents for select
  using (auth.role() = 'authenticated');
create policy "Tenant docs write" on tenant_documents for all
  using (is_admin() or has_role('AGENT'))
  with check (is_admin() or has_role('AGENT'));

create policy "Contracts read" on contracts for select
  using (auth.role() = 'authenticated');
create policy "Contracts write" on contracts for all
  using (is_admin() or has_role('AGENT'))
  with check (is_admin() or has_role('AGENT'));

create policy "Payments read" on payments for select
  using (auth.role() = 'authenticated');
create policy "Payments write" on payments for all
  using (is_admin() or has_role('ACCOUNTANT'))
  with check (is_admin() or has_role('ACCOUNTANT'));

create policy "Favorites read" on favorites for select
  using (auth.uid() = user_id);
create policy "Favorites write" on favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Messages read" on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Messages insert" on messages for insert
  with check (auth.uid() = sender_id);
create policy "Messages update" on messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

create policy "Push tokens read" on user_push_tokens for select
  using (auth.uid() = user_id);
create policy "Push tokens write" on user_push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Notifications read" on notifications for select
  using (auth.role() = 'authenticated');
create policy "Notifications write" on notifications for all
  using (is_admin())
  with check (is_admin());

create policy "Logs read" on activity_logs for select
  using (auth.role() = 'authenticated');
create policy "Logs write" on activity_logs for all
  using (is_admin())
  with check (is_admin());

-- ====== STORAGE POLICIES (property-images) ======
drop policy if exists "Property images read public" on storage.objects;
drop policy if exists "Property images upload own" on storage.objects;
drop policy if exists "Property images update own" on storage.objects;
drop policy if exists "Property images delete own" on storage.objects;

create policy "Property images read public" on storage.objects for select
  using (bucket_id = 'property-images');

create policy "Property images upload own" on storage.objects for insert
  with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or auth.uid()::text = split_part(name, '/', 1)
    )
  );

create policy "Property images update own" on storage.objects for update
  using (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or auth.uid()::text = split_part(name, '/', 1)
    )
  )
  with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or auth.uid()::text = split_part(name, '/', 1)
    )
  );

create policy "Property images delete own" on storage.objects for delete
  using (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or auth.uid()::text = split_part(name, '/', 1)
    )
  );

-- ====== PROFIL ADMIN (OPTIONNEL) ======
-- Remplacez <USER_ID> par l'id de l'utilisateur cree dans Auth
-- insert into profiles (id, full_name, role) values ('<USER_ID>', 'Admin', 'ADMIN');
