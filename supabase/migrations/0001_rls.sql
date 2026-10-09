-- LEGACY DRAFT — do not execute this file on a production database.
-- It uses JWT app_metadata while the application/back-office uses profiles.role.
-- Use admin/supabase/schema.sql followed by docs/supabase-production-migration.sql.

-- Helper: admin check via JWT app_metadata.is_admin
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

-- PROPERTIES
alter table public.properties enable row level security;

-- Public can read approved listings; owners and admins can read everything
create policy "properties_select_public_approved"
on public.properties
for select
using (
  (listing_status = 'approved')
  or (owner_id = auth.uid())
  or (is_admin())
);

-- Only admins can insert/update/delete properties (back-office flow)
create policy "properties_admin_all"
on public.properties
for all
using (is_admin())
with check (is_admin());

-- PROPERTY IMAGES (table referenced by properties select)
alter table public.property_images enable row level security;

create policy "property_images_select_public"
on public.property_images
for select
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_images.property_id
      and (p.listing_status = 'approved' or p.owner_id = auth.uid() or is_admin())
  )
);

create policy "property_images_admin_all"
on public.property_images
for all
using (is_admin())
with check (is_admin());

-- FAVORITES
alter table public.favorites enable row level security;

create policy "favorites_owner_rw"
on public.favorites
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- MESSAGES
alter table public.messages enable row level security;

create policy "messages_participants_select"
on public.messages
for select
using (sender_id = auth.uid() or receiver_id = auth.uid() or is_admin());

create policy "messages_sender_insert"
on public.messages
for insert
with check (sender_id = auth.uid());

create policy "messages_participants_update"
on public.messages
for update
using (sender_id = auth.uid() or receiver_id = auth.uid() or is_admin())
with check (sender_id = auth.uid() or receiver_id = auth.uid() or is_admin());

-- USER PUSH TOKENS
alter table public.user_push_tokens enable row level security;

create policy "push_tokens_owner_all"
on public.user_push_tokens
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- NEIGHBORHOODS (managed by admin)
alter table public.neighborhoods enable row level security;
create policy "neighborhoods_public_select" on public.neighborhoods for select using (true);
create policy "neighborhoods_admin_all" on public.neighborhoods for all using (is_admin()) with check (is_admin());

-- TENANTS, CONTRACTS, PAYMENTS (admin only in app)
alter table public.tenants enable row level security;
create policy "tenants_admin_all" on public.tenants for all using (is_admin()) with check (is_admin());

alter table public.contracts enable row level security;
create policy "contracts_admin_all" on public.contracts for all using (is_admin()) with check (is_admin());

alter table public.payments enable row level security;
create policy "payments_admin_all" on public.payments for all using (is_admin()) with check (is_admin());

-- REPORTS (if present)
alter table public.reports enable row level security;
create policy "reports_owner_insert" on public.reports for insert with check (user_id = auth.uid());
create policy "reports_owner_select" on public.reports for select using (user_id = auth.uid() or is_admin());
create policy "reports_admin_update" on public.reports for update using (is_admin()) with check (is_admin());

-- STORAGE POLICIES (optional, adjust buckets to match your setup)
-- Property images bucket (public read, admin write)
create policy "storage_property_images_public_read"
on storage.objects
for select
using (bucket_id = 'property-images');

create policy "storage_property_images_admin_all"
on storage.objects
for all
using (bucket_id = 'property-images' and is_admin())
with check (bucket_id = 'property-images' and is_admin());

-- Tenant documents bucket (admin only)
create policy "storage_tenant_docs_admin_all"
on storage.objects
for all
using (bucket_id = 'tenant-documents' and is_admin())
with check (bucket_id = 'tenant-documents' and is_admin());

-- Mobile release artifacts (APK/AAB hosted publicly if you choose this approach)
-- Recommended: keep the bucket public-read but restrict writes to admins only.
create policy "storage_releases_public_read"
on storage.objects
for select
using (bucket_id = 'releases');

create policy "storage_releases_admin_all"
on storage.objects
for all
using (bucket_id = 'releases' and is_admin())
with check (bucket_id = 'releases' and is_admin());
