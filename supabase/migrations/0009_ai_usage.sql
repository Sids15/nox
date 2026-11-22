-- Nox 0009 — a per-user daily counter for AI requests.
--
-- The `ai` Edge Function calls bump_ai_usage() before every model call. It counts the CALLER's
-- requests (auth.uid(), never an id from the request) and refuses once the day's cap is reached, so
-- one account can't burn through the project's free tier or run up a bill. Apply after 0001–0008.

create table if not exists public.ai_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  day     date not null default current_date,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Users may read their own counter (Settings shows "N of M today"); writes go through the function.
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select using (user_id = auth.uid());

-- Atomically add one request for the signed-in user; returns false (and adds nothing) at the cap.
create or replace function public.bump_ai_usage(cap integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day)
    do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < greatest(cap, 0)
  returning count into used;

  return used is not null;
end $$;

revoke all on function public.bump_ai_usage(integer) from public;
grant execute on function public.bump_ai_usage(integer) to authenticated;
