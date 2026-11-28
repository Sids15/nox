-- Nox 0019: reminders sent by the server (push), so they arrive even when Nox hasn't been opened.
-- Payloads carry counts only — never task titles (rules: remote push is IDs-only). Safe to re-run.
--
--  push_devices  one row per phone (Expo push token) or browser (Web Push subscription), owner-only.
--  users.push_prefs  which reminders, and the morning hour.
--  push_log      what was sent to whom on which local day, so an hourly run never sends twice.
--                Service-only: RLS on with no policies.

create table if not exists public.push_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null check (kind in ('expo', 'web')),
  -- Expo: "ExponentPushToken[…]". Web: the subscription's endpoint URL.
  token       text not null unique check (length(token) <= 1000),
  -- Web Push only: { p256dh, auth }.
  keys        jsonb,
  -- IANA time zone of the device ("Europe/London"), so reminders arrive at local times.
  tz          text not null default 'UTC' check (length(tz) <= 64),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_devices_user_idx on public.push_devices (user_id);

drop trigger if exists set_updated_at on public.push_devices;
create trigger set_updated_at before update on public.push_devices for each row execute function public.set_updated_at();
alter table public.push_devices enable row level security;
drop policy if exists push_devices_owner on public.push_devices;
create policy push_devices_owner on public.push_devices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.users add column if not exists push_prefs jsonb not null
  default '{"morning": true, "overdue": true, "deadlines": true, "hour": 8}'::jsonb;

create table if not exists public.push_log (
  user_id  uuid not null references public.users(id) on delete cascade,
  kind     text not null,
  day      date not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.push_log enable row level security;

-- Old log rows are only useful for a day or two.
create index if not exists push_log_day_idx on public.push_log (day);
