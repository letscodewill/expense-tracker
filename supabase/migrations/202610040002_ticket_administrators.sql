begin;

-- Run after 202610040001_ticket_support.sql. Pin the owner's verified UUID.
create table if not exists public.support_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
alter table public.support_owner enable row level security;
revoke all on public.support_owner from public, anon, authenticated;
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = 'williansantos38@gmail.com' and email_confirmed_at is not null;
  if owner_id is null then raise exception 'Conta proprietária confirmada não encontrada.'; end if;
  insert into public.support_owner(singleton, user_id) values (true, owner_id) on conflict (singleton) do nothing;
  insert into public.ticket_admins(user_id) select user_id from public.support_owner on conflict do nothing;
end $$;
revoke all on public.ticket_admins from public, anon, authenticated;

create or replace function public.is_support_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.support_owner o join auth.users u on u.id = o.user_id
    where o.user_id = (select auth.uid()) and lower(u.email) = 'williansantos38@gmail.com' and u.email_confirmed_at is not null);
$$;

-- Retain the existing RPC name used by ticket policies and mutations.
create or replace function public.is_ticket_master()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.ticket_admins a join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid()) and u.email_confirmed_at is not null);
$$;

create or replace function public.list_ticket_administrators()
returns table(user_id uuid, email text, is_owner boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_support_owner() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  return query select a.user_id, u.email::text, exists (select 1 from public.support_owner o where o.user_id = a.user_id)
    from public.ticket_admins a join auth.users u on u.id = a.user_id order by lower(u.email);
end $$;

create or replace function public.add_ticket_administrator(account_email text)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_id uuid;
begin
  if not public.is_support_owner() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if account_email is null or char_length(btrim(account_email)) not between 3 and 254 then raise exception 'E-mail inválido.'; end if;
  select id into target_id from auth.users where lower(email) = lower(btrim(account_email)) and email_confirmed_at is not null;
  if target_id is null then raise exception 'Conta confirmada não encontrada.'; end if;
  insert into public.ticket_admins(user_id) values (target_id) on conflict do nothing;
end $$;

create or replace function public.remove_ticket_administrator(account_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_support_owner() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if account_id is null then raise exception 'Conta inválida.'; end if;
  if exists (select 1 from public.support_owner where user_id = account_id) then raise exception 'O proprietário não pode ser removido.'; end if;
  delete from public.ticket_admins where user_id = account_id;
end $$;

revoke all on function public.is_support_owner(), public.is_ticket_master(), public.list_ticket_administrators(), public.add_ticket_administrator(text), public.remove_ticket_administrator(uuid) from public, anon;
grant execute on function public.is_support_owner(), public.is_ticket_master(), public.list_ticket_administrators(), public.add_ticket_administrator(text), public.remove_ticket_administrator(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
