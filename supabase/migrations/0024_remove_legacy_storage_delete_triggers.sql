begin;

do $$
declare
  legacy_trigger record;
  removed_triggers integer := 0;
begin
  for legacy_trigger in
    select table_schema.nspname as schema_name,
           target_table.relname as table_name,
           trigger_row.tgname as trigger_name
      from pg_trigger trigger_row
      join pg_class target_table on target_table.oid = trigger_row.tgrelid
      join pg_namespace table_schema on table_schema.oid = target_table.relnamespace
      join pg_proc trigger_function on trigger_function.oid = trigger_row.tgfoid
     where not trigger_row.tgisinternal
       and table_schema.nspname = 'public'
       and trigger_function.prosrc ~* 'delete[[:space:]]+from[[:space:]]+storage\.objects'
  loop
    execute format(
      'drop trigger %I on %I.%I',
      legacy_trigger.trigger_name,
      legacy_trigger.schema_name,
      legacy_trigger.table_name
    );
    removed_triggers := removed_triggers + 1;
  end loop;

  raise notice 'Removed % legacy direct Storage deletion trigger(s).', removed_triggers;
end;
$$;

commit;
