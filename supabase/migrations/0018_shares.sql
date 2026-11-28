-- Nox 0018: read-only share links. A row says "anyone with this token may view this note, idea or
-- space". Only the owner can see or change their rows (RLS); the public `share` Edge Function reads
-- by token with the service key and returns a text-only copy. Deleting (or flagging) a row ends the
-- link at once. Safe to re-run.
create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  -- 64 hex characters from two random UUIDs (~244 random bits); the link's secret.
  token       text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  kind        text not null check (kind in ('note', 'idea', 'space')),
  target_id   uuid not null,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint shares_token_format check (token ~ '^[0-9a-f]{64}$')
);

create index if not exists shares_user_target_idx on public.shares (user_id, kind, target_id) where not deleted;

drop trigger if exists set_updated_at on public.shares;
create trigger set_updated_at before update on public.shares for each row execute function public.set_updated_at();
alter table public.shares enable row level security;
drop policy if exists shares_owner on public.shares;
create policy shares_owner on public.shares for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A token is made by the database, never chosen by the client; and a share can only point at
-- something the same account owns (foreign keys skip RLS; see 0010).
create or replace function public.shares_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  elsif new.token is distinct from old.token or new.target_id is distinct from old.target_id or new.kind is distinct from old.kind then
    raise exception 'a share link cannot be changed, only removed' using errcode = '42501';
  end if;
  if (new.kind = 'note'  and not exists (select 1 from public.notes  n where n.id = new.target_id and n.user_id = new.user_id))
  or (new.kind = 'idea'  and not exists (select 1 from public.ideas  i where i.id = new.target_id and i.user_id = new.user_id))
  or (new.kind = 'space' and not exists (select 1 from public.spaces s where s.id = new.target_id and s.user_id = new.user_id)) then
    raise exception 'that belongs to another account' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists shares_guard on public.shares;
create trigger shares_guard before insert or update on public.shares
  for each row execute function public.shares_guard();
