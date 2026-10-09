-- Allow an authenticated user to request (or re-request) agent access without
-- granting the client permission to edit roles or other profile fields.
create or replace function public.request_agent_access()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_id uuid := auth.uid();
  current_role public.user_role;
  current_status text;
  updated_rows integer;
begin
  if requester_id is null then
    raise exception 'Authentication is required to request agent access.';
  end if;

  select role, agent_status
    into current_role, current_status
    from public.profiles
    where id = requester_id;

  if not found then
    raise exception 'User profile was not found.';
  end if;

  if current_role <> 'USER' then
    raise exception 'Only regular user accounts can request agent access.';
  end if;

  if current_status = 'pending' then
    return;
  end if;

  if current_status not in ('none', 'rejected') then
    raise exception 'Agent access cannot be requested in the current account state.';
  end if;

  update public.profiles
    set agent_status = 'pending',
        agent_rejection_reason = null
    where id = requester_id
      and role = 'USER'
      and agent_status in ('none', 'rejected');

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    select role, agent_status
      into current_role, current_status
      from public.profiles
      where id = requester_id;
    if current_role <> 'USER' or current_status = 'pending' then
      return;
    end if;
    raise exception 'Agent access could not be requested in the current account state.';
  end if;
end;
$$;

revoke all on function public.request_agent_access() from public;
grant execute on function public.request_agent_access() to authenticated;
