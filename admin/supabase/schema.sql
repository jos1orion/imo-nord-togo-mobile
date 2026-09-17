-- Schema for Imo Nord Togo Back Office (Supabase)

create type user_role as enum ('USER', 'ADMIN', 'AGENT', 'ACCOUNTANT');
create type property_type as enum ('house', 'land', 'apartment', 'shop');
create type property_status as enum ('available', 'occupied');
create type listing_status as enum ('pending', 'approved', 'rejected', 'archived');
create type contract_status as enum ('active', 'expired');
create type payment_method as enum ('cash', 'mobile_money');
create type payment_status as enum ('paid', 'late', 'pending');
create type tenant_document_type as enum ('cni', 'contract', 'other');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'USER',
  created_at timestamptz not null default now()
);

create table properties (
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

create table property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants on delete cascade,
  type tenant_document_type not null default 'cni',
  url text not null,
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties on delete restrict,
  tenant_id uuid references tenants on delete restrict,
  start_date date not null,
  end_date date not null,
  rent_amount numeric not null,
  status contract_status not null default 'active',
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts on delete cascade,
  amount numeric not null,
  paid_at date not null,
  method payment_method not null default 'cash',
  status payment_status not null default 'paid',
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'rappel',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_logs (
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

create trigger properties_updated_at
before update on properties
for each row execute procedure set_updated_at();

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

create trigger property_images_limit
before insert on property_images
for each row execute procedure enforce_property_images_limit();

-- RLS
alter table profiles enable row level security;
alter table properties enable row level security;
alter table property_images enable row level security;
alter table neighborhoods enable row level security;
alter table tenants enable row level security;
alter table tenant_documents enable row level security;
alter table contracts enable row level security;
alter table payments enable row level security;
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
