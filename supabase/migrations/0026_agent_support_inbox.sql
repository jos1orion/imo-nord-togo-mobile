begin;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists support_conversations_one_open_per_agent
  on public.support_conversations(agent_id)
  where status = 'open';

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_created_idx
  on public.support_messages(conversation_id, created_at);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_conversations_agent_or_admin_select"
  on public.support_conversations;
create policy "support_conversations_agent_or_admin_select"
  on public.support_conversations for select
  using (
    public.is_admin()
    or (
      agent_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role::text = 'AGENT'
      )
    )
  );

drop policy if exists "support_conversations_agent_insert"
  on public.support_conversations;
create policy "support_conversations_agent_insert"
  on public.support_conversations for insert
  with check (
    agent_id = auth.uid()
    and status = 'open'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role::text = 'AGENT'
    )
  );

drop policy if exists "support_conversations_admin_update"
  on public.support_conversations;
create policy "support_conversations_admin_update"
  on public.support_conversations for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "support_messages_agent_or_admin_select"
  on public.support_messages;
create policy "support_messages_agent_or_admin_select"
  on public.support_messages for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.support_conversations conversation
      join public.profiles agent on agent.id = conversation.agent_id
      where conversation.id = conversation_id
        and conversation.agent_id = auth.uid()
        and agent.role::text = 'AGENT'
    )
  );

drop policy if exists "support_messages_agent_or_admin_insert"
  on public.support_messages;
create policy "support_messages_agent_or_admin_insert"
  on public.support_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.support_conversations conversation
        join public.profiles agent on agent.id = conversation.agent_id
        where conversation.id = conversation_id
          and conversation.agent_id = auth.uid()
          and conversation.status = 'open'
          and agent.role::text = 'AGENT'
      )
    )
  );

drop policy if exists "support_messages_agent_or_admin_mark_read"
  on public.support_messages;
create policy "support_messages_agent_or_admin_mark_read"
  on public.support_messages for update
  using (
    public.is_admin()
    or exists (
      select 1
      from public.support_conversations conversation
      join public.profiles agent on agent.id = conversation.agent_id
      where conversation.id = conversation_id
        and conversation.agent_id = auth.uid()
        and agent.role::text = 'AGENT'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.support_conversations conversation
      join public.profiles agent on agent.id = conversation.agent_id
      where conversation.id = conversation_id
        and conversation.agent_id = auth.uid()
        and agent.role::text = 'AGENT'
    )
  );

revoke all on public.support_conversations, public.support_messages
  from public, anon, authenticated;

grant select, insert on public.support_conversations to authenticated;
grant update (status) on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant update (read_at) on public.support_messages to authenticated;

create or replace function public.prepare_support_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.created_at := now();
  new.read_at := null;
  return new;
end;
$$;

drop trigger if exists support_messages_prepare_insert
  on public.support_messages;
create trigger support_messages_prepare_insert
before insert on public.support_messages
for each row execute function public.prepare_support_message();

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_conversation
  on public.support_messages;
create trigger support_messages_touch_conversation
after insert on public.support_messages
for each row execute function public.touch_support_conversation();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'support_conversations'
    ) then
      alter publication supabase_realtime add table public.support_conversations;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'support_messages'
    ) then
      alter publication supabase_realtime add table public.support_messages;
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
