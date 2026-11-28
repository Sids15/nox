-- Nox 0014: a space can have a deadline (its goal is the existing description).
alter table public.spaces add column if not exists due_date date;
