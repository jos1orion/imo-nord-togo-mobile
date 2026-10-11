-- Allow active accounts with an agent request to publish immediately from
-- 2026-12-01 through 2027-05-31 (UTC). Normal agent approval is required again
-- starting 2027-06-01 (Togo uses UTC).

begin;

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
          now() >= timestamptz '2026-12-01 00:00:00+00'
          and now() < timestamptz '2027-06-01 00:00:00+00'
          and listing_status = 'approved'
          and (
            profile.role in ('ADMIN', 'AGENT')
            or (
              profile.role = 'USER'
              and profile.agent_status in ('pending', 'rejected')
            )
          )
        )
        or (
          (
            now() < timestamptz '2026-12-01 00:00:00+00'
            or now() >= timestamptz '2027-06-01 00:00:00+00'
          )
          and profile.role in ('ADMIN', 'AGENT')
          and (profile.role = 'ADMIN' or profile.agent_status = 'approved')
          and listing_status = 'pending'
        )
      )
  )
);

drop policy if exists "properties_update_own_private" on public.properties;
create policy "properties_update_own_private" on public.properties
for update
using (
  owner_id = auth.uid()
  and (
    listing_status in ('pending', 'rejected')
    or (
      listing_status = 'approved'
      and now() >= timestamptz '2026-12-01 00:00:00+00'
      and now() < timestamptz '2027-06-01 00:00:00+00'
      and exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.account_status = 'active'
          and (
            profile.role in ('ADMIN', 'AGENT')
            or (
              profile.role = 'USER'
              and profile.agent_status in ('pending', 'rejected')
            )
          )
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
      and now() >= timestamptz '2026-12-01 00:00:00+00'
      and now() < timestamptz '2027-06-01 00:00:00+00'
      and exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.account_status = 'active'
          and (
            profile.role in ('ADMIN', 'AGENT')
            or (
              profile.role = 'USER'
              and profile.agent_status in ('pending', 'rejected')
            )
          )
      )
    )
  )
);

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
        and now() >= timestamptz '2026-12-01 00:00:00+00'
        and now() < timestamptz '2027-06-01 00:00:00+00'
        and created_at > now() - interval '10 minutes'
        and exists (
          select 1
          from public.profiles profile
          where profile.id = auth.uid()
            and profile.account_status = 'active'
            and (
              profile.role in ('ADMIN', 'AGENT')
              or (
                profile.role = 'USER'
                and profile.agent_status in ('pending', 'rejected')
              )
            )
        )
      )
    )
  )
);

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
          now() >= timestamptz '2026-12-01 00:00:00+00'
          and now() < timestamptz '2027-06-01 00:00:00+00'
          and p.listing_status = 'approved'
          and (
            profile.role in ('ADMIN', 'AGENT')
            or (
              profile.role = 'USER'
              and profile.agent_status in ('pending', 'rejected')
            )
          )
        )
        or (
          (
            now() < timestamptz '2026-12-01 00:00:00+00'
            or now() >= timestamptz '2027-06-01 00:00:00+00'
          )
          and profile.role in ('ADMIN', 'AGENT')
          and (profile.role = 'ADMIN' or profile.agent_status = 'approved')
          and p.listing_status in ('pending', 'rejected')
        )
      )
  )
);

drop policy if exists "property_images_delete_owner" on public.property_images;
create policy "property_images_delete_owner" on public.property_images
for delete using (
  public.is_admin()
  or exists (
    select 1
    from public.properties p
    join public.profiles profile on profile.id = p.owner_id
    where p.id = property_id
      and p.owner_id = auth.uid()
      and p.listing_status = 'approved'
      and now() >= timestamptz '2026-12-01 00:00:00+00'
      and now() < timestamptz '2027-06-01 00:00:00+00'
      and p.created_at > now() - interval '10 minutes'
      and profile.account_status = 'active'
      and (
        profile.role in ('ADMIN', 'AGENT')
        or (
          profile.role = 'USER'
          and profile.agent_status in ('pending', 'rejected')
        )
      )
  )
);

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
            now() >= timestamptz '2026-12-01 00:00:00+00'
            and now() < timestamptz '2027-06-01 00:00:00+00'
            and p.listing_status = 'approved'
            and (
              profile.role in ('ADMIN', 'AGENT')
              or (
                profile.role = 'USER'
                and profile.agent_status in ('pending', 'rejected')
              )
            )
          )
          or (
            (
              now() < timestamptz '2026-12-01 00:00:00+00'
              or now() >= timestamptz '2027-06-01 00:00:00+00'
            )
            and profile.role in ('ADMIN', 'AGENT')
            and (profile.role = 'ADMIN' or profile.agent_status = 'approved')
            and p.listing_status in ('pending', 'rejected')
          )
        )
    )
  )
);

commit;
