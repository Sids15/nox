-- Nox 0010 — security hardening. Apply after 0001–0009. Safe to re-run.
--
-- 1. Rate limits for the Edge Functions (per user per minute, per user per day, and a project-wide
--    daily ceiling for AI so many users together can't exhaust the model's free tier).
-- 2. An account-wide "Nox AI" switch the `ai` function enforces, so turning AI off on one device
--    stops it everywhere — not just hiding buttons.
-- 3. A row can't point at another account's folder or task (foreign keys skip RLS).
-- 4. Size ceilings, so one account can't store unbounded data.

-- ── 1. Rate limits ───────────────────────────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  -- A user id, or 'project' for a ceiling shared by everyone.
  key          text not null,
  bucket       text not null,
  day          date not null default current_date,
  count        integer not null default 0,
  minute_start timestamptz not null default date_trunc('minute', now()),
  minute_count integer not null default 0,
  primary key (key, bucket, day)
);

alter table public.rate_limits enable row level security;

-- People may read their own counters (Settings shows today's AI use). Nobody writes them directly.
drop policy if exists rate_limits_select_own on public.rate_limits;
create policy rate_limits_select_own on public.rate_limits
  for select using (key = auth.uid()::text);

/**
 * Count one request against `bucket` for user `uid`, or refuse it. Returns:
 *   'ok' | 'minute' (too many this minute) | 'day' (daily allowance used) | 'project' (the shared
 *   daily ceiling is reached) | 'disabled' (the user turned Nox AI off; only for bucket 'ai').
 * Only the Edge Functions call this, with the service key, after verifying who the caller is —
 * `uid` is never taken from a request body.
 */
create or replace function public.hit_rate_limit(
  p_uid uuid,
  p_bucket text,
  p_per_minute integer,
  p_per_day integer,
  p_project_per_day integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := p_uid::text;
  cur public.rate_limits;
  this_minute timestamptz := date_trunc('minute', now());
begin
  if p_uid is null then
    return 'disabled';
  end if;

  if p_bucket = 'ai' and exists (select 1 from public.users u where u.id = p_uid and u.ai_enabled = false) then
    return 'disabled';
  end if;

  insert into public.rate_limits as r (key, bucket, day) values (k, p_bucket, current_date)
  on conflict (key, bucket, day) do nothing;

  -- Lock this user's row so concurrent requests count one at a time.
  select * into cur from public.rate_limits r
    where r.key = k and r.bucket = p_bucket and r.day = current_date
    for update;

  if cur.minute_start < this_minute then
    cur.minute_start := this_minute;
    cur.minute_count := 0;
  end if;
  if cur.minute_count >= p_per_minute then
    return 'minute';
  end if;
  if cur.count >= p_per_day then
    return 'day';
  end if;

  if p_project_per_day is not null then
    insert into public.rate_limits as r (key, bucket, day, count) values ('project', p_bucket, current_date, 1)
    on conflict (key, bucket, day) do update
      set count = r.count + 1
      where r.count < p_project_per_day;
    if not found then
      return 'project';
    end if;
  end if;

  update public.rate_limits r
     set count = cur.count + 1, minute_start = cur.minute_start, minute_count = cur.minute_count + 1
   where r.key = k and r.bucket = p_bucket and r.day = current_date;
  return 'ok';
end $$;

revoke all on function public.hit_rate_limit(uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(uuid, text, integer, integer, integer) to service_role;

-- 0009's counter is superseded; nobody needs to call it any more.
revoke all on function public.bump_ai_usage(integer) from authenticated;

-- Old counters are only useful for a few days.
create index if not exists rate_limits_day_idx on public.rate_limits (day);

-- ── 2. The account-wide AI switch ────────────────────────────────────────────────────────────────
alter table public.users add column if not exists ai_enabled boolean not null default true;

-- ── 3. No pointing at another account's rows ─────────────────────────────────────────────────────
-- A foreign key is checked without RLS, so without this a user could file a note under someone
-- else's folder id or hang a task off someone else's task (and be cascade-deleted with it).
create or replace function public.same_owner_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'notes' and new.folder_id is not null
     and not exists (select 1 from public.folders f where f.id = new.folder_id and f.user_id = new.user_id) then
    raise exception 'folder belongs to another account' using errcode = '42501';
  end if;
  if tg_table_name = 'folders' and new.parent_id is not null
     and not exists (select 1 from public.folders f where f.id = new.parent_id and f.user_id = new.user_id) then
    raise exception 'parent folder belongs to another account' using errcode = '42501';
  end if;
  if tg_table_name = 'tasks' and new.origin_task_id is not null
     and not exists (select 1 from public.tasks t where t.id = new.origin_task_id and t.user_id = new.user_id) then
    raise exception 'origin task belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['notes', 'folders', 'tasks'] loop
    execute format('drop trigger if exists same_owner_refs on public.%I', t);
    execute format(
      'create trigger same_owner_refs before insert or update on public.%I
         for each row execute function public.same_owner_refs()', t);
  end loop;
end $$;

-- ── 4. Size ceilings ─────────────────────────────────────────────────────────────────────────────
-- NOT VALID: checked on every new write, existing rows are left alone. Generous on purpose — the
-- app's own limits are far lower; these stop scripted abuse, not normal use.
do $$
begin
  alter table public.notes     add constraint notes_size     check (pg_column_size(content) <= 1048576 and coalesce(length(title), 0) <= 500 and coalesce(array_length(tags, 1), 0) <= 50) not valid;
exception when duplicate_object then null; end $$;
do $$
begin
  alter table public.ideas     add constraint ideas_size     check (pg_column_size(content) <= 1048576 and length(title) <= 500 and coalesce(array_length(tags, 1), 0) <= 50) not valid;
exception when duplicate_object then null; end $$;
do $$
begin
  alter table public.tasks     add constraint tasks_size     check (length(title) <= 500 and coalesce(length(notes), 0) <= 5000 and coalesce(array_length(reminder_times, 1), 0) <= 20) not valid;
exception when duplicate_object then null; end $$;
do $$
begin
  alter table public.resources add constraint resources_size check (coalesce(length(url), 0) <= 4000 and coalesce(length(title), 0) <= 1000 and coalesce(length(body), 0) <= 50000 and coalesce(array_length(tag_ids, 1), 0) <= 50) not valid;
exception when duplicate_object then null; end $$;
do $$
begin
  alter table public.folders   add constraint folders_size   check (length(name) <= 200) not valid;
exception when duplicate_object then null; end $$;
do $$
begin
  alter table public.tags      add constraint tags_size      check (length(name) <= 100 and length(color) <= 40) not valid;
exception when duplicate_object then null; end $$;
