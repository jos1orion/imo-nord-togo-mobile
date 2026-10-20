begin;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  constraint account_deletion_requests_status_check
    check (status in ('pending', 'in_progress', 'completed', 'rejected'))
);

create unique index if not exists account_deletion_requests_active_email_uidx
  on public.account_deletion_requests (lower(email))
  where email is not null and status in ('pending', 'in_progress');

create index if not exists account_deletion_requests_status_created_idx
  on public.account_deletion_requests (status, created_at desc);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant all on public.account_deletion_requests to service_role;

notify pgrst, 'reload schema';

commit;
