-- Durcissement auth / roles. A executer apres docs/supabase-admin-platform.sql.

create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and not public.is_admin() then
      raise exception 'Seul un administrateur peut modifier un role';
    end if;
    if new.account_status is distinct from old.account_status and not public.is_admin() then
      raise exception 'Seul un administrateur peut modifier le statut du compte';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_privilege_escalation();

drop policy if exists "Profiles write admin" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_update_own_contact" on public.profiles;
create policy "profiles_update_own_contact" on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());
