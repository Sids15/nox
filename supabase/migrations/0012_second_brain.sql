-- Nox 0012 — second brain: Spaces, templates, fields and custom stages. Apply after 0001–0011.
-- Safe to re-run.
--
-- 1. Spaces: an area of work or life ("YouTube – Tech", "Freelance") holding its own notes, ideas,
--    tasks and resources, with its own pipeline of stages for the board.
-- 2. Templates: reusable starting points (title, body, fields) for notes and ideas.
-- 3. Fields ("properties") and a pipeline stage on notes and ideas.
-- Links between pages need no table: they are link blocks pointing at nox://<kind>/<id>, so older
-- app versions still show them as ordinary link cards.

-- ── 1. Spaces ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  icon        text not null default '',
  color       text not null default '',
  description text,
  stages      text[] not null default '{}',
  position    integer not null default 0,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint spaces_size check (
    length(name) <= 80 and length(icon) <= 16 and length(color) <= 20
    and coalesce(length(description), 0) <= 2000
    and coalesce(array_length(stages, 1), 0) <= 20
  )
);

-- ── 2. Templates ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  kind        text not null default 'note' check (kind in ('note', 'idea')),
  title       text,
  content     jsonb not null default '[]',
  properties  jsonb not null default '[]',
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint templates_size check (
    length(name) <= 80 and coalesce(length(title), 0) <= 200
    and pg_column_size(content) <= 262144 and pg_column_size(properties) <= 65536
  )
);

-- ── 3. Space, fields and stage on existing rows ──────────────────────────────────────────────────
alter table public.notes     add column if not exists space_id   uuid references public.spaces(id) on delete set null;
alter table public.ideas     add column if not exists space_id   uuid references public.spaces(id) on delete set null;
alter table public.tasks     add column if not exists space_id   uuid references public.spaces(id) on delete set null;
alter table public.resources add column if not exists space_id   uuid references public.spaces(id) on delete set null;
alter table public.notes     add column if not exists properties jsonb not null default '[]';
alter table public.ideas     add column if not exists properties jsonb not null default '[]';
alter table public.notes     add column if not exists stage      text;
alter table public.ideas     add column if not exists stage      text;

do $$
begin
  alter table public.notes add constraint notes_fields_size check (pg_column_size(properties) <= 65536 and coalesce(length(stage), 0) <= 60) not valid;
exception when duplicate_object then null; end $$;
do $$
begin
  alter table public.ideas add constraint ideas_fields_size check (pg_column_size(properties) <= 65536 and coalesce(length(stage), 0) <= 60) not valid;
exception when duplicate_object then null; end $$;

create index if not exists spaces_user_updated_idx    on public.spaces    (user_id, updated_at desc);
create index if not exists templates_user_updated_idx on public.templates (user_id, updated_at desc);
create index if not exists notes_space_idx            on public.notes     (space_id);
create index if not exists ideas_space_idx            on public.ideas     (space_id);
create index if not exists tasks_space_idx            on public.tasks     (space_id);
create index if not exists resources_space_idx        on public.resources (space_id);

-- ── updated_at, RLS, Realtime: same conventions as 0001/0004/0005 ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['spaces', 'templates'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── No pointing at another account's space (foreign keys skip RLS; see 0010) ─────────────────────
-- One function per table, as in 0011: a trigger function naming a column its table lacks fails.
create or replace function public.notes_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folder_id is not null
     and not exists (select 1 from public.folders f where f.id = new.folder_id and f.user_id = new.user_id) then
    raise exception 'folder belongs to another account' using errcode = '42501';
  end if;
  if new.space_id is not null
     and not exists (select 1 from public.spaces s where s.id = new.space_id and s.user_id = new.user_id) then
    raise exception 'space belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.tasks_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origin_task_id is not null
     and not exists (select 1 from public.tasks t where t.id = new.origin_task_id and t.user_id = new.user_id) then
    raise exception 'origin task belongs to another account' using errcode = '42501';
  end if;
  if new.space_id is not null
     and not exists (select 1 from public.spaces s where s.id = new.space_id and s.user_id = new.user_id) then
    raise exception 'space belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.ideas_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.space_id is not null
     and not exists (select 1 from public.spaces s where s.id = new.space_id and s.user_id = new.user_id) then
    raise exception 'space belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.resources_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.space_id is not null
     and not exists (select 1 from public.spaces s where s.id = new.space_id and s.user_id = new.user_id) then
    raise exception 'space belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['notes', 'folders', 'tasks', 'ideas', 'resources'] loop
    execute format('drop trigger if exists same_owner on public.%I', t);
    execute format(
      'create trigger same_owner before insert or update on public.%I
         for each row execute function public.%I()', t, t || '_same_owner');
  end loop;
end $$;
