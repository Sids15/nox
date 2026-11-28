-- Nox 0017: when a task was finished. Set by the database itself (every app version and device gets
-- it right), used by the weekly Review and Insights. Safe to re-run.
alter table public.tasks add column if not exists completed_at timestamptz;

create or replace function public.tasks_completed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'complete' then
    if tg_op = 'INSERT' or old.status is distinct from 'complete' or new.completed_at is null then
      new.completed_at := coalesce(case when tg_op = 'UPDATE' and old.status = 'complete' then old.completed_at end, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists completed_at on public.tasks;
create trigger completed_at before insert or update of status, completed_at on public.tasks
  for each row execute function public.tasks_completed_at();

-- Tasks finished before this migration: their last change is the best guess.
update public.tasks set completed_at = updated_at where status = 'complete' and completed_at is null;

create index if not exists tasks_completed_idx on public.tasks (user_id, completed_at) where completed_at is not null;
