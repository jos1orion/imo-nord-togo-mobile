-- Keep installations created from the reports schema compatible with the
-- application table name and owner column: property_reports.user_id.

begin;

do $$
begin
  if to_regclass('public.property_reports') is null
     and to_regclass('public.reports') is not null then
    alter table public.reports rename to property_reports;
  elsif to_regclass('public.property_reports') is not null
        and to_regclass('public.reports') is not null then
    raise exception
      'Both public.reports and public.property_reports exist; reconcile them before applying this migration.';
  end if;

  if to_regclass('public.property_reports') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'property_reports'
        and column_name = 'reporter_id'
    ) and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'property_reports'
        and column_name = 'user_id'
    ) then
      alter table public.property_reports rename column reporter_id to user_id;
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'property_reports'
        and column_name = 'reporter_id'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'property_reports'
        and column_name = 'user_id'
    ) then
      raise exception
        'Both reporter_id and user_id exist on public.property_reports; reconcile the columns before applying this migration.';
    end if;

    alter table public.property_reports enable row level security;
  end if;
end
$$;

commit;
