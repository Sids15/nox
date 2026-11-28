-- Nox 0016: Focus sessions. Each finished focus timer is one row: when it started, how many minutes
-- were actually focused, and the task / space it was for (both optional). Insights adds them up.
-- Safe to re-run.
create table if not exists public.focus_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  task_id     uuid references public.tasks(id) on delete set null,
  space_id    uuid references public.spaces(id) on delete set null,
  started_at  timestamptz not null,
  minutes     integer not null check (minutes between 1 and 600),
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);
create index if not exists focus_sessions_task_idx on public.focus_sessions (task_id);
create index if not exists focus_sessions_space_idx on public.focus_sessions (space_id);

-- updated_at, RLS, Realtime: same conventions as 0012.
drop trigger if exists set_updated_at on public.focus_sessions;
create trigger set_updated_at before update on public.focus_sessions for each row execute function public.set_updated_at();
alter table public.focus_sessions enable row level security;
drop policy if exists focus_sessions_owner on public.focus_sessions;
create policy focus_sessions_owner on public.focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.focus_sessions replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'focus_sessions'
  ) then
    alter publication supabase_realtime add table public.focus_sessions;
  end if;
end $$;

-- No pointing at another account's task or space (foreign keys skip RLS; see 0010).
create or replace function public.focus_sessions_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.task_id is not null
     and not exists (select 1 from public.tasks t where t.id = new.task_id and t.user_id = new.user_id) then
    raise exception 'task belongs to another account' using errcode = '42501';
  end if;
  if new.space_id is not null
     and not exists (select 1 from public.spaces s where s.id = new.space_id and s.user_id = new.user_id) then
    raise exception 'space belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists same_owner on public.focus_sessions;
create trigger same_owner before insert or update on public.focus_sessions
  for each row execute function public.focus_sessions_same_owner();
