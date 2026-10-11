# Supabase SQL source of truth

SQL deployment changes are maintained only in the root [`supabase/migrations/`](../../supabase/migrations/) directory.

Do not add schema or policy copies under `admin/supabase/`. The former `schema.sql` and `setup.sql` scripts duplicated the mobile migrations and have been removed to prevent drift. Historical SQL files under `docs/` are retained for reference, not as deployment inputs.

Review each migration's prerequisites before applying it to an existing project. In particular, `0001_rls.sql` is an explicitly marked legacy draft and must not be applied to production.
