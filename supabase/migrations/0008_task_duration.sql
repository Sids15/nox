-- Nox 0008 — how long a task takes, so the calendar can draw it at its real length.
-- Minutes; null = not set (the calendar draws 30). Bounded to a day.

alter table public.tasks
  add column if not exists duration_minutes integer
    check (duration_minutes is null or (duration_minutes between 5 and 1440));
