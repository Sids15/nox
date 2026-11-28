-- Nox 0020: Email to Nox. Each account may have one private address, <token>@<your inbound domain>.
-- Email sent there (by a Cloudflare Email Worker → the inbound-email function) lands in the Inbox.
-- The token is the address's secret: made by the database, never chosen by the client. A new address
-- = delete the row and add another. By default only email from the account's own address is taken.
-- Safe to re-run.
create table if not exists public.inbound_addresses (
  user_id     uuid primary key references public.users(id) on delete cascade,
  token       text not null unique,
  -- false: only mail from the account's sign-in email is accepted.
  any_sender  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint inbound_token_format check (token ~ '^[a-z0-9]{20}$')
);

drop trigger if exists set_updated_at on public.inbound_addresses;
create trigger set_updated_at before update on public.inbound_addresses for each row execute function public.set_updated_at();
alter table public.inbound_addresses enable row level security;
drop policy if exists inbound_addresses_owner on public.inbound_addresses;
create policy inbound_addresses_owner on public.inbound_addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 20 characters of [a-z0-9] from random UUID hex (no ambiguous capitals in an email address).
create or replace function public.inbound_addresses_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.token := substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 20);
  elsif new.token is distinct from old.token then
    raise exception 'make a new address instead of changing this one' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists inbound_addresses_guard on public.inbound_addresses;
create trigger inbound_addresses_guard before insert or update on public.inbound_addresses
  for each row execute function public.inbound_addresses_guard();
