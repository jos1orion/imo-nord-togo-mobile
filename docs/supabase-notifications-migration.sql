-- Adds user-scoped notifications for the mobile application.
-- Safe to run after admin/supabase/schema.sql or the production bootstrap.

alter table public.notifications
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_admin_all" on public.notifications;
drop policy if exists "notifications_user_select" on public.notifications;
drop policy if exists "notifications_user_update" on public.notifications;
drop policy if exists "notifications_user_delete" on public.notifications;

create policy "notifications_user_select" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

create policy "notifications_user_update" on public.notifications
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "notifications_user_delete" on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());

create policy "notifications_admin_all" on public.notifications
  for insert with check (public.is_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
