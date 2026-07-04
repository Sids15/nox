-- Nox 0005 — Resources module: user-defined colored tags + saved resources.
-- Owner-scoped via RLS, soft-delete tombstones, updated_at triggers, Realtime — same conventions
-- as 0001/0004. Apply after 0001–0004.

-- ── Enum ─────────────────────────────────────────────────────────────────────
do $$ begin
  create type resource_type as enum ('link', 'image', 'video', 'text');
exception when duplicate_object then null; end $$;

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  color      text not null,
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  type          resource_type not null default 'link',
  url           text,
  title         text,
  domain        text,
  thumbnail_url text,
  duration      text,
  body          text,
  tag_ids       uuid[] not null default '{}',
  is_archived   boolean not null default false,
  deleted       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── updated_at triggers ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tags','resources'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists tags_user_idx           on public.tags      (user_id);
create index if not exists resources_user_updated_idx on public.resources (user_id, updated_at desc);

-- ── Row Level Security (owner-only) ──────────────────────────────────────────
alter table public.tags      enable row level security;
alter table public.resources enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tags','resources'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
         for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tags','resources'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
