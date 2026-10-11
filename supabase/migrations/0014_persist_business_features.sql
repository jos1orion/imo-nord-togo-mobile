create table if not exists public.agent_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  bio text not null default '',
  specialties text[] not null default '{}',
  experience integer not null default 0 check (experience >= 0),
  license_number text,
  company text,
  portfolio uuid[] not null default '{}',
  verified boolean not null default false,
  rating numeric not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  total_sales integer not null default 0 check (total_sales >= 0),
  total_commission numeric not null default 0 check (total_commission >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  filters jsonb not null default '{}'::jsonb,
  property_type text not null check (property_type in ('house', 'land', 'apartment', 'shop', 'ALL')),
  active boolean not null default true,
  last_triggered timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_listings (
  property_id uuid primary key references public.properties on delete cascade,
  plan text not null check (plan in ('BASIC', 'FEATURED', 'PREMIUM')),
  start_date timestamptz not null,
  end_date timestamptz not null,
  price numeric not null check (price >= 0),
  features text[] not null default '{}',
  payment_reference text not null unique,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users on delete cascade,
  property_type text not null check (property_type in ('house', 'land', 'apartment', 'shop', 'ALL')),
  percentage numeric not null check (percentage > 0 and percentage <= 100),
  min_amount numeric not null default 0 check (min_amount >= 0),
  max_amount numeric not null default 999999999 check (max_amount >= min_amount),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.property_transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete restrict,
  buyer_id uuid not null references auth.users on delete restrict,
  seller_id uuid not null references auth.users on delete restrict,
  agent_id uuid references auth.users on delete set null,
  amount numeric not null check (amount > 0),
  commission numeric check (commission is null or commission >= 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete cascade,
  name text not null,
  type text not null check (type in ('contract', 'inspection', 'permit', 'other')),
  url text not null,
  uploaded_by uuid not null references auth.users on delete cascade,
  uploaded_at timestamptz not null default now()
);

create index if not exists search_alerts_user_created_idx
  on public.search_alerts (user_id, created_at desc);
create index if not exists commission_rules_agent_idx
  on public.commission_rules (agent_id, active);
create index if not exists property_transactions_participants_idx
  on public.property_transactions (buyer_id, seller_id, created_at desc);
create index if not exists property_documents_property_idx
  on public.property_documents (property_id, uploaded_at desc);

alter table public.agent_profiles enable row level security;
alter table public.search_alerts enable row level security;
alter table public.premium_listings enable row level security;
alter table public.commission_rules enable row level security;
alter table public.property_transactions enable row level security;
alter table public.property_documents enable row level security;

drop policy if exists "agent_profiles_owner_select" on public.agent_profiles;
drop policy if exists "agent_profiles_owner_insert" on public.agent_profiles;
drop policy if exists "agent_profiles_owner_update" on public.agent_profiles;
drop policy if exists "agent_profiles_admin_all" on public.agent_profiles;
create policy "agent_profiles_owner_select" on public.agent_profiles for select
  using (user_id = auth.uid() or public.is_admin());
create policy "agent_profiles_owner_insert" on public.agent_profiles for insert
  with check (user_id = auth.uid());
create policy "agent_profiles_owner_update" on public.agent_profiles for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
revoke insert on public.agent_profiles from public, anon, authenticated;
grant insert (user_id, bio, specialties, experience, license_number, company, portfolio)
  on public.agent_profiles to authenticated;
revoke update on public.agent_profiles from public, anon, authenticated;
grant update (bio, specialties, experience, license_number, company, portfolio)
  on public.agent_profiles to authenticated;

drop policy if exists "search_alerts_owner_all" on public.search_alerts;
create policy "search_alerts_owner_all" on public.search_alerts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "premium_listings_owner_select" on public.premium_listings;
drop policy if exists "premium_listings_admin_all" on public.premium_listings;
create policy "premium_listings_owner_select" on public.premium_listings for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.properties p
      where p.id = property_id and p.owner_id = auth.uid()
    )
  );
revoke insert, update, delete on public.premium_listings from public, anon, authenticated;
grant select on public.premium_listings to authenticated;

drop policy if exists "commission_rules_owner_all" on public.commission_rules;
create policy "commission_rules_owner_all" on public.commission_rules for all
  using (agent_id = auth.uid() or public.is_admin())
  with check (agent_id = auth.uid() or public.is_admin());

drop policy if exists "property_transactions_participant_select" on public.property_transactions;
drop policy if exists "property_transactions_buyer_insert" on public.property_transactions;
drop policy if exists "property_transactions_admin_update" on public.property_transactions;
create policy "property_transactions_participant_select" on public.property_transactions for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "property_transactions_buyer_insert" on public.property_transactions for insert
  with check (
    buyer_id = auth.uid()
    and status = 'PENDING'
    and exists (
      select 1 from public.properties p
      where p.id = property_id and p.owner_id = seller_id
    )
  );
create policy "property_transactions_admin_update" on public.property_transactions for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "property_documents_participant_select" on public.property_documents;
drop policy if exists "property_documents_owner_insert" on public.property_documents;
drop policy if exists "property_documents_owner_delete" on public.property_documents;
create policy "property_documents_participant_select" on public.property_documents for select
  using (
    uploaded_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.properties p
      where p.id = property_id and p.owner_id = auth.uid()
    )
  );
create policy "property_documents_owner_insert" on public.property_documents for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id = property_id and p.owner_id = auth.uid()
    )
  );
create policy "property_documents_owner_delete" on public.property_documents for delete
  using (uploaded_by = auth.uid() or public.is_admin());
