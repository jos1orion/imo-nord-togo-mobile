begin;

drop policy if exists "support_conversations_admin_insert"
  on public.support_conversations;
create policy "support_conversations_admin_insert"
  on public.support_conversations for insert
  with check (
    public.is_admin()
    and status = 'open'
    and exists (
      select 1
      from public.profiles
      where id = agent_id and role::text = 'AGENT'
    )
  );

notify pgrst, 'reload schema';

commit;
