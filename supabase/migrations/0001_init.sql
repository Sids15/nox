-- Nox 0001 — core schema, RLS, triggers, soft-delete tombstones.
-- All app tables live in `public`, are owner-scoped via RLS, and carry created_at/updated_at.

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type priority_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type idea_status as enum ('raw', 'exploring', 'validating', 'complete', 'dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('pending', 'complete', 'carried_over');
exception when duplicate_object then null; end $$;

do $$ begin
  create type note_type as enum ('text', 'voice', 'sketch', 'mixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type repeat_kind as enum ('none', 'daily', 'weekly', 'weekdays', 'custom');
exception when duplicate_object then null; end $$;

-- ── Shared triggers ──────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-provision a public.users row when an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  display_name text,
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  description text,
  priority    priority_level not null default 'medium',
  status      idea_status not null default 'raw',
  tags        text[] not null default '{}',
  is_archived boolean not null default false,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  parent_id  uuid references public.folders(id) on delete set null,
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text,
  type        note_type not null default 'text',
  content     jsonb not null default '[]'::jsonb,
  folder_id   uuid references public.folders(id) on delete set null,
  tags        text[] not null default '{}',
  is_pinned   boolean not null default false,
  is_archived boolean not null default false,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  title          text not null,
  notes          text,
  due_date       date,
  due_time       time,
  reminder_times timestamptz[] not null default '{}',
  priority       task_priority not null default 'medium',
  status         task_status not null default 'pending',
  repeat         repeat_kind not null default 'none',
  repeat_config  jsonb,
  deleted        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── updated_at triggers ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['users','ideas','folders','notes','tasks'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Indexes (sync reads by user + updated_at) ────────────────────────────────
create index if not exists ideas_user_updated_idx   on public.ideas   (user_id, updated_at desc);
create index if not exists folders_user_updated_idx on public.folders (user_id, updated_at desc);
create index if not exists notes_user_updated_idx   on public.notes   (user_id, updated_at desc);
create index if not exists notes_folder_idx         on public.notes   (folder_id);
create index if not exists tasks_user_updated_idx   on public.tasks   (user_id, updated_at desc);

-- ── Row Level Security (owner-only on every table) ───────────────────────────
alter table public.users   enable row level security;
alter table public.ideas   enable row level security;
alter table public.folders enable row level security;
alter table public.notes   enable row level security;
alter table public.tasks   enable row level security;

drop policy if exists users_self on public.users;
create policy users_self on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['ideas','folders','notes','tasks'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
         for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;
