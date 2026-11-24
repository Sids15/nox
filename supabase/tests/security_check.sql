-- Nox security check — paste into the Supabase SQL Editor and Run.
--
-- Creates two throwaway accounts, tries the things an attacker would, and reports PASS/FAIL for
-- each. The report is delivered as an ERROR on purpose: raising an error at the end rolls the whole
-- run back, so nothing it created (accounts, rows, counters) is left in your database.
--
-- Expect a red "ERROR: P0001: NOX SECURITY REPORT …" — that IS the result. Read the lines inside it.

do $check$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  report text[] := '{}';
  v text;
  n integer;
  folder_a uuid := gen_random_uuid();
  task_a uuid := gen_random_uuid();
  note_a uuid := gen_random_uuid();
  space_a uuid := gen_random_uuid();
  missing text;
begin
  -- ── Setup: two accounts (the sign-up trigger creates their public.users rows) ─────────────────
  insert into auth.users (id, email, aud, role) values
    (a, 'nox-check-a-' || a || '@example.invalid', 'authenticated', 'authenticated'),
    (b, 'nox-check-b-' || b || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.folders (id, user_id, name) values (folder_a, a, 'A folder');
  insert into public.tasks (id, user_id, title) values (task_a, a, 'A task');
  insert into public.notes (id, user_id, title) values (note_a, a, 'A private note');
  insert into public.spaces (id, user_id, name) values (space_a, a, 'A space');

  -- ── 1. Every table in public has Row Level Security on ─────────────────────────────────────────
  select string_agg(c.relname, ', ') into missing
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  report := report || format('%s  RLS on every public table%s',
    case when missing is null then 'PASS' else 'FAIL' end,
    coalesce(' — missing on: ' || missing, ''));

  -- ── 2. Only the server can call the rate limiter; the old counter is closed ────────────────────
  report := report || format('%s  hit_rate_limit: not callable by signed-in users or anon, callable by service_role',
    case when not has_function_privilege('authenticated', 'public.hit_rate_limit(uuid,text,integer,integer,integer)', 'execute')
          and not has_function_privilege('anon', 'public.hit_rate_limit(uuid,text,integer,integer,integer)', 'execute')
          and has_function_privilege('service_role', 'public.hit_rate_limit(uuid,text,integer,integer,integer)', 'execute')
         then 'PASS' else 'FAIL' end);
  report := report || format('%s  bump_ai_usage (0009) no longer callable by signed-in users',
    case when not has_function_privilege('authenticated', 'public.bump_ai_usage(integer)', 'execute') then 'PASS' else 'FAIL' end);

  -- ── 3. Rate limits ─────────────────────────────────────────────────────────────────────────────
  begin
    v := '';
    for i in 1..4 loop
      v := v || public.hit_rate_limit(a, 'chk_minute', 3, 100) || ' ';
    end loop;
    report := report || format('%s  per-minute limit 3 → %s', case when v = 'ok ok ok minute ' then 'PASS' else 'FAIL' end, trim(v));
  exception when others then report := report || ('FAIL  per-minute limit — error: ' || sqlerrm); end;

  begin
    v := '';
    for i in 1..3 loop
      v := v || public.hit_rate_limit(a, 'chk_day', 100, 2) || ' ';
    end loop;
    report := report || format('%s  daily limit 2 → %s', case when v = 'ok ok day ' then 'PASS' else 'FAIL' end, trim(v));
  exception when others then report := report || ('FAIL  daily limit — error: ' || sqlerrm); end;

  begin
    v := public.hit_rate_limit(a, 'chk_project', 100, 100, 1) || ' ' || public.hit_rate_limit(b, 'chk_project', 100, 100, 1);
    report := report || format('%s  project-wide limit 1 shared by two users → %s', case when v = 'ok project' then 'PASS' else 'FAIL' end, v);
  exception when others then report := report || ('FAIL  project-wide limit — error: ' || sqlerrm); end;

  begin
    update public.users set ai_enabled = false where id = a;
    v := public.hit_rate_limit(a, 'ai', 100, 100) || ' ' || public.hit_rate_limit(a, 'url_meta', 100, 100);
    report := report || format('%s  AI switched off → ai refused, link previews still ok → %s', case when v = 'disabled ok' then 'PASS' else 'FAIL' end, v);
    update public.users set ai_enabled = true where id = a;
  exception when others then report := report || ('FAIL  AI switch — error: ' || sqlerrm); end;

  -- ── 4. As account B: can't see or touch account A's data ───────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  begin
    select count(*) into n from public.notes where id = note_a;
    report := report || format('%s  B reads A''s note → %s rows', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B reads A''s note — error: ' || sqlerrm); end;

  begin
    update public.notes set title = 'hacked' where id = note_a;
    get diagnostics n = row_count;
    report := report || format('%s  B edits A''s note → %s rows changed', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B edits A''s note — error: ' || sqlerrm); end;

  begin
    delete from public.tasks where id = task_a;
    get diagnostics n = row_count;
    report := report || format('%s  B deletes A''s task → %s rows deleted', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B deletes A''s task — error: ' || sqlerrm); end;

  begin
    insert into public.notes (user_id, title) values (a, 'planted');
    report := report || text 'FAIL  B creates a note in A''s account → allowed';
  exception when others then report := report || text 'PASS  B creates a note in A''s account → refused'; end;

  begin
    insert into public.notes (user_id, title, folder_id) values (b, 'mine', folder_a);
    report := report || text 'FAIL  B files a note in A''s folder → allowed';
  exception when others then report := report || format('PASS  B files a note in A''s folder → refused (%s)', sqlerrm); end;

  begin
    insert into public.tasks (user_id, title, origin_task_id) values (b, 'mine', task_a);
    report := report || text 'FAIL  B hangs a task off A''s task → allowed';
  exception when others then report := report || format('PASS  B hangs a task off A''s task → refused (%s)', sqlerrm); end;

  begin
    insert into public.notes (user_id, title, space_id) values (b, 'mine', space_a);
    report := report || text 'FAIL  B files a note in A''s space → allowed';
  exception when others then report := report || format('PASS  B files a note in A''s space → refused (%s)', sqlerrm); end;

  begin
    select count(*) into n from public.spaces where id = space_a;
    report := report || format('%s  B reads A''s space → %s rows', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B reads A''s space — error: ' || sqlerrm); end;

  begin
    select count(*) into n from public.rate_limits where key = a::text;
    report := report || format('%s  B reads A''s usage counters → %s rows', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B reads A''s counters — error: ' || sqlerrm); end;

  begin
    insert into public.rate_limits (key, bucket, count) values (b::text, 'ai', -1000);
    report := report || text 'FAIL  B resets its own AI counter → allowed';
  exception when others then report := report || text 'PASS  B writes its own usage counter → refused'; end;

  begin
    perform public.hit_rate_limit(b, 'ai', 1000000, 1000000);
    report := report || text 'FAIL  B calls the rate limiter directly → allowed';
  exception when others then report := report || text 'PASS  B calls the rate limiter directly → refused'; end;

  begin
    update public.users set ai_enabled = false where id = a;
    get diagnostics n = row_count;
    report := report || format('%s  B switches off A''s AI → %s rows changed', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B switches A''s AI — error: ' || sqlerrm); end;

  begin
    select count(*) into n from storage.objects where (storage.foldername(name))[1] = a::text;
    report := report || format('%s  B lists A''s files in storage → %s', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || ('FAIL  B lists A''s files — error: ' || sqlerrm); end;

  -- ── 5. Size ceilings (as B, on B's own rows) ───────────────────────────────────────────────────
  begin
    insert into public.tasks (user_id, title) values (b, repeat('x', 600));
    report := report || text 'FAIL  600-character task title → allowed';
  exception when others then report := report || text 'PASS  600-character task title → refused'; end;

  begin
    insert into public.tasks (user_id, title) values (b, 'Normal task');
    report := report || text 'PASS  B can still add its own normal task';
  exception when others then report := report || ('FAIL  B adding its own task — error: ' || sqlerrm); end;

  execute 'reset role';

  -- ── 6. Anonymous visitors see nothing ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  begin
    select (select count(*) from public.notes) + (select count(*) from public.tasks) + (select count(*) from public.users)
      + (select count(*) from public.rate_limits) into n;
    report := report || format('%s  signed-out visitor reads notes/tasks/users/counters → %s rows', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then report := report || text 'PASS  signed-out visitor reads data → refused'; end;
  execute 'reset role';

  -- ── Report (and roll everything back) ──────────────────────────────────────────────────────────
  raise exception E'NOX SECURITY REPORT — % passed, % failed (everything above was rolled back)\n%',
    (select count(*) from unnest(report) r where r like 'PASS%'),
    (select count(*) from unnest(report) r where r like 'FAIL%'),
    array_to_string(report, E'\n');
end
$check$;
