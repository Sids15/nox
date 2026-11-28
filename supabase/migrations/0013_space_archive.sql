-- Nox 0013: finished spaces can be archived — kept, but out of the way.
alter table public.spaces add column if not exists archived boolean not null default false;
