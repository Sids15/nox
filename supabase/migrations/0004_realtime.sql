-- Nox 0004 — enable Realtime for synced tables.
-- `replica identity full` so UPDATE/DELETE payloads carry full rows; add tables to the
-- supabase_realtime publication (guarded so re-runs are safe). Clients MUST subscribe with a
-- user_id filter — never a wildcard (see rules.md).

do $$
declare t text;
begin
  foreach t in array array['ideas','folders','notes','tasks'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
