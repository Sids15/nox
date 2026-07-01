-- Nox 0002 — task recurrence + streaks (generate-on-demand model, split carryover).
-- A task with repeat != 'none' is a *template*; concrete occurrences reference it via
-- origin_task_id. Normal tasks carry over; recurring tasks repeat fresh and track a streak.

alter table public.tasks
  add column if not exists origin_task_id    uuid references public.tasks(id) on delete cascade,
  add column if not exists sort_order        integer not null default 0,
  add column if not exists streak_count      integer not null default 0,
  add column if not exists longest_streak    integer not null default 0,
  add column if not exists last_completed_on date;

-- One occurrence per (template, due_date).
create unique index if not exists tasks_origin_due_unique
  on public.tasks (origin_task_id, due_date)
  where origin_task_id is not null;

create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
