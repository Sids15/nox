-- Nox 0011 — fix 0010's cross-account check. Its single trigger function read notes.folder_id,
-- folders.parent_id and tasks.origin_task_id on every table, and PL/pgSQL fails on a column the
-- table doesn't have — so every insert/update of notes, folders and tasks errored with 42703.
-- Replaced by one function per table. (0010 itself is corrected too, for fresh databases.)

-- One function per table: a trigger function that names a column the table doesn't have
-- (tasks.folder_id) fails on every write, even behind an `if` for another table.
create or replace function public.notes_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folder_id is not null
     and not exists (select 1 from public.folders f where f.id = new.folder_id and f.user_id = new.user_id) then
    raise exception 'folder belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.folders_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null
     and not exists (select 1 from public.folders f where f.id = new.parent_id and f.user_id = new.user_id) then
    raise exception 'parent folder belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.tasks_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origin_task_id is not null
     and not exists (select 1 from public.tasks t where t.id = new.origin_task_id and t.user_id = new.user_id) then
    raise exception 'origin task belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['notes', 'folders', 'tasks'] loop
    execute format('drop trigger if exists same_owner_refs on public.%I', t);
    execute format('drop trigger if exists same_owner on public.%I', t);
    execute format(
      'create trigger same_owner before insert or update on public.%I
         for each row execute function public.%I()', t, t || '_same_owner');
  end loop;
end $$;
drop function if exists public.same_owner_refs();

