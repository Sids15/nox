-- Nox 0021: two-way Google Calendar. Safe to re-run.
--
--  gcal_accounts  one per connected account. The app may read whether it's connected (the Google
--                 address, the push switch) and flip the switch — never the tokens: column grants
--                 below leave the encrypted refresh token readable by the server only.
--  gcal_states    short-lived sign-in attempts (state + PKCE verifier). Server only.
--  gcal_links     which task is which Google event, and when they were last in step. Server only.

create table if not exists public.gcal_accounts (
  user_id            uuid primary key references public.users(id) on delete cascade,
  google_email       text,
  -- AES-GCM sealed with the function's GCAL_TOKEN_KEY; never readable by the app.
  refresh_token_enc  text not null,
  time_zone          text not null default 'UTC',
  -- Timed Nox tasks go to Google.
  push_tasks         boolean not null default true,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists set_updated_at on public.gcal_accounts;
create trigger set_updated_at before update on public.gcal_accounts for each row execute function public.set_updated_at();
alter table public.gcal_accounts enable row level security;
drop policy if exists gcal_accounts_owner_read on public.gcal_accounts;
create policy gcal_accounts_owner_read on public.gcal_accounts for select using (auth.uid() = user_id);
drop policy if exists gcal_accounts_owner_update on public.gcal_accounts;
create policy gcal_accounts_owner_update on public.gcal_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.gcal_accounts from anon, authenticated;
grant select (user_id, google_email, push_tasks, last_synced_at, created_at) on public.gcal_accounts to authenticated;
grant update (push_tasks) on public.gcal_accounts to authenticated;

create table if not exists public.gcal_states (
  state       text primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  verifier    text not null,
  return_to   text not null,
  created_at  timestamptz not null default now()
);
alter table public.gcal_states enable row level security;
revoke all on public.gcal_states from anon, authenticated;

create table if not exists public.gcal_links (
  task_id    uuid primary key references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  event_id   text not null,
  synced_at  timestamptz not null default now()
);
create index if not exists gcal_links_user_idx on public.gcal_links (user_id);
alter table public.gcal_links enable row level security;
revoke all on public.gcal_links from anon, authenticated;
