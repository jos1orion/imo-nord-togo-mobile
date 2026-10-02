-- Imo Nord Togo — plateforme admin (biens vs publications, moderation, roles RLS).
-- A executer APRES supabase-user-role.sql et supabase-production-migration.sql.

alter table public.profiles
  add column if not exists account_status text not null default 'active';

do $$ begin
  alter table public.profiles
    add constraint profiles_account_status_check
    check (account_status in ('active', 'suspended', 'pending'));
exception when duplicate_object then null;
end $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;

create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'ACCOUNTANT'
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;

create or replace function public.is_agent()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'AGENT'
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('ADMIN', 'AGENT', 'ACCOUNTANT')
      and coalesce(account_status, 'active') <> 'suspended'
  );
$$;

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and coalesce(account_status, 'active') = 'active'
  );
$$;

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete cascade,
  status public.listing_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  featured boolean not null default false,
  featured_start_at timestamptz,
  featured_end_at timestamptz,
  payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'pending', 'paid', 'failed')),
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now()
);

create index if not exists publications_property_idx on public.publications (property_id, created_at desc);
create index if not exists publications_status_idx on public.publications (status);

alter table public.properties
  add column if not exists current_publication_id uuid references public.publications(id) on delete set null;

create table if not exists public.listing_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete cascade,
  publication_id uuid references public.publications on delete set null,
  event text not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists listing_events_property_idx on public.listing_events (property_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete cascade,
  reporter_id uuid references auth.users on delete set null,
  reason text not null check (reason in ('FRAUD', 'DUPLICATE', 'INAPPROPRIATE', 'OTHER')),
  message text not null default '',
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete cascade,
  user_id uuid references auth.users on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.publication_payments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications on delete cascade,
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'XOF',
  provider text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Backfill one publication per existing property that has none.
insert into public.publications (
  property_id, status, submitted_at, approved_at, published_at, expires_at,
  featured, featured_start_at, featured_end_at
)
select
  p.id,
  coalesce(p.listing_status, 'pending'),
  coalesce(p.submitted_at, p.created_at, now()),
  p.approved_at,
  p.published_at,
  p.expires_at,
  coalesce(p.featured, false),
  p.featured_start_at,
  p.featured_end_at
from public.properties p
where not exists (select 1 from public.publications pub where pub.property_id = p.id);

update public.properties p
set current_publication_id = sub.id
from (
  select distinct on (property_id) id, property_id
  from public.publications
  order by property_id, created_at desc
) sub
where p.id = sub.property_id and p.current_publication_id is null;

insert into public.listing_events (property_id, publication_id, event, created_at)
select p.id, p.current_publication_id, 'submitted', coalesce(p.submitted_at, p.created_at)
from public.properties p
where p.current_publication_id is not null
  and not exists (select 1 from public.listing_events e where e.publication_id = p.current_publication_id);

create or replace function public.record_listing_event(p_property uuid, p_publication uuid, p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.listing_events (property_id, publication_id, event, actor_id)
  values (p_property, p_publication, p_event, auth.uid());
end;
$$;
revoke all on function public.record_listing_event(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_listing_event(uuid, uuid, text) to service_role;

create or replace function public.sync_publication_from_property()
returns trigger language plpgsql security definer set search_path = public as $$
declare pub_id uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.publications (
      property_id, status, submitted_at, approved_at, published_at, expires_at,
      featured, featured_start_at, featured_end_at
    ) values (
      new.id, coalesce(new.listing_status, 'pending'), coalesce(new.submitted_at, now()),
      new.approved_at, new.published_at, new.expires_at, coalesce(new.featured, false),
      new.featured_start_at, new.featured_end_at
    ) returning id into pub_id;
    update public.properties set current_publication_id = pub_id where id = new.id;
    perform public.record_listing_event(new.id, pub_id, 'submitted');
    return new;
  end if;

  if new.current_publication_id is distinct from old.current_publication_id
     and new.listing_status is not distinct from old.listing_status
     and new.featured is not distinct from old.featured
     and new.expires_at is not distinct from old.expires_at
     and new.status is not distinct from old.status then
    return new;
  end if;

  if old.listing_status in ('archived', 'rejected') and new.listing_status = 'pending' then
    insert into public.publications (
      property_id, status, submitted_at, featured
    ) values (new.id, 'pending', now(), false)
    returning id into pub_id;
    new.current_publication_id := pub_id;
    update public.properties set current_publication_id = pub_id where id = new.id;
    perform public.record_listing_event(new.id, pub_id, 'submitted');
    return new;
  end if;

  pub_id := new.current_publication_id;
  if pub_id is null then
    insert into public.publications (
      property_id, status, submitted_at, approved_at, published_at, expires_at, featured
    ) values (
      new.id, coalesce(new.listing_status, 'pending'), now(), new.approved_at,
      new.published_at, new.expires_at, coalesce(new.featured, false)
    ) returning id into pub_id;
    update public.properties set current_publication_id = pub_id where id = new.id;
  else
    update public.publications set
      status = coalesce(new.listing_status, status),
      approved_at = new.approved_at,
      published_at = new.published_at,
      expires_at = new.expires_at,
      featured = coalesce(new.featured, featured),
      featured_start_at = new.featured_start_at,
      featured_end_at = new.featured_end_at
    where id = pub_id;
  end if;

  if old.listing_status is distinct from new.listing_status then
    if new.listing_status = 'approved' then
      perform public.record_listing_event(new.id, pub_id, 'approved');
      perform public.record_listing_event(new.id, pub_id, 'published');
    elsif new.listing_status = 'rejected' then
      perform public.record_listing_event(new.id, pub_id, 'rejected');
    elsif new.listing_status = 'archived' then
      perform public.record_listing_event(new.id, pub_id, 'expired');
    end if;
  end if;

  if coalesce(old.featured, false) is distinct from coalesce(new.featured, false) then
    perform public.record_listing_event(
      new.id, pub_id, case when new.featured then 'featured' else 'featured_end' end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists properties_sync_publication on public.properties;
create trigger properties_sync_publication
after insert or update on public.properties
for each row execute function public.sync_publication_from_property();

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
     returning id, owner_id, current_publication_id
  ), pub as (
    update public.publications p
       set status = 'archived', featured = false
      from expired e
     where p.id = e.current_publication_id or p.property_id = e.id
    returning e.id
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
revoke all on function public.expire_due_listings() from public, anon, authenticated;
grant execute on function public.expire_due_listings() to service_role;

alter table public.publications enable row level security;
alter table public.listing_events enable row level security;
alter table public.reports enable row level security;
alter table public.reviews enable row level security;
alter table public.publication_payments enable row level security;

drop policy if exists "properties_select_public_or_owner" on public.properties;
drop policy if exists "properties_insert_own_pending" on public.properties;
create policy "properties_select_public_or_owner" on public.properties for select using (
  (listing_status = 'approved' and status = 'available' and (expires_at is null or expires_at > now()))
  or owner_id = auth.uid()
  or public.is_admin()
);
create policy "properties_insert_own_pending" on public.properties for insert with check (
  auth.uid() = owner_id
  and listing_status = 'pending'
  and coalesce(featured, false) = false
  and public.is_active_account()
);

drop policy if exists "publications_select" on public.publications;
drop policy if exists "publications_admin" on public.publications;
create policy "publications_select" on public.publications for select using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
      and (
        (p.listing_status = 'approved' and p.status = 'available' and (p.expires_at is null or p.expires_at > now()))
        or p.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);
create policy "publications_admin" on public.publications for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "listing_events_select" on public.listing_events;
drop policy if exists "listing_events_admin" on public.listing_events;
create policy "listing_events_select" on public.listing_events for select using (
  exists (
    select 1 from public.properties p
    where p.id = property_id and (p.owner_id = auth.uid() or public.is_admin())
  )
);
create policy "listing_events_admin" on public.listing_events for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reports_insert_auth" on public.reports;
drop policy if exists "reports_select" on public.reports;
drop policy if exists "reports_admin" on public.reports;
create policy "reports_insert_auth" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select" on public.reports for select using (
  reporter_id = auth.uid() or public.is_admin()
);
create policy "reports_admin" on public.reports for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reviews_select" on public.reviews;
drop policy if exists "reviews_insert" on public.reviews;
drop policy if exists "reviews_admin" on public.reviews;
create policy "reviews_select" on public.reviews for select using (true);
create policy "reviews_insert" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews_admin" on public.reviews for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "publication_payments_finance" on public.publication_payments;
create policy "publication_payments_finance" on public.publication_payments for all
using (public.is_admin() or public.is_accountant())
with check (public.is_admin() or public.is_accountant());

drop policy if exists "tenants_admin_all" on public.tenants;
drop policy if exists "tenant_documents_admin_all" on public.tenant_documents;
drop policy if exists "contracts_admin_all" on public.contracts;
drop policy if exists "payments_admin_all" on public.payments;
create policy "tenants_admin_all" on public.tenants for all
using (public.is_admin() or public.is_accountant()) with check (public.is_admin() or public.is_accountant());
create policy "tenant_documents_admin_all" on public.tenant_documents for all
using (public.is_admin() or public.is_accountant()) with check (public.is_admin() or public.is_accountant());
create policy "contracts_admin_all" on public.contracts for all
using (public.is_admin() or public.is_accountant()) with check (public.is_admin() or public.is_accountant());
create policy "payments_admin_all" on public.payments for all
using (public.is_admin() or public.is_accountant()) with check (public.is_admin() or public.is_accountant());

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select
using (id = auth.uid() or public.is_admin());
