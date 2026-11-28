-- Nox 0015: the Inbox. Things captured without a home (share sheet, widgets, "Add to Nox") are marked
-- inbox = true and listed on the Inbox page until they're given a day, a space, or kept as they are.
alter table public.tasks     add column if not exists inbox boolean not null default false;
alter table public.notes     add column if not exists inbox boolean not null default false;
alter table public.ideas     add column if not exists inbox boolean not null default false;
alter table public.resources add column if not exists inbox boolean not null default false;

-- The Inbox page reads only the few rows still marked.
create index if not exists tasks_inbox_idx     on public.tasks (user_id)     where inbox;
create index if not exists notes_inbox_idx     on public.notes (user_id)     where inbox;
create index if not exists ideas_inbox_idx     on public.ideas (user_id)     where inbox;
create index if not exists resources_inbox_idx on public.resources (user_id) where inbox;
