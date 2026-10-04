begin;

-- Assign the role to the existing verified account UUID, never user_metadata.
create table if not exists public.ticket_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.ticket_admins enable row level security;
revoke all on public.ticket_admins from anon, authenticated;

do $$
declare master_id uuid;
begin
  select id into master_id from auth.users
  where lower(email) = 'williansantos38@gmail.com' and email_confirmed_at is not null;
  if master_id is null then
    raise exception 'A conta master precisa existir e ter o e-mail confirmado antes desta migração.';
  end if;
  insert into public.ticket_admins(user_id) values (master_id) on conflict do nothing;
end $$;

create or replace function public.is_ticket_master()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ticket_admins a join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid())
      and lower(u.email) = 'williansantos38@gmail.com' and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_ticket_master() from public, anon;
grant execute on function public.is_ticket_master() to authenticated;

alter table public.reports add column if not exists created_at timestamptz not null default now();
alter table public.reports add column if not exists status text not null default 'aberto';
alter table public.reports add column if not exists closed_at timestamptz;
create unique index if not exists reports_protocol_support_unique on public.reports(protocol_number);
create index if not exists reports_support_owner_protocol on public.reports(user_id, protocol_number desc);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.reports'::regclass and conname = 'reports_support_status_check') then
    alter table public.reports add constraint reports_support_status_check check (status in ('aberto', 'em_atendimento', 'finalizado'));
  end if;
end $$;

create table if not exists public.report_replies (
  id uuid primary key default gen_random_uuid(),
  report_protocol bigint not null references public.reports(protocol_number) on delete cascade,
  author_id uuid not null references auth.users(id),
  message text not null check (char_length(btrim(message)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists report_replies_protocol_created on public.report_replies(report_protocol, created_at);
alter table public.reports enable row level security;
alter table public.report_replies enable row level security;

-- Permissive policies are OR'ed. Replace policies only on support tables so an
-- old broad policy cannot accidentally grant access to another user's tickets.
do $$ declare item record;
begin
  for item in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('reports', 'report_replies')
  loop execute format('drop policy %I on public.%I', item.policyname, item.tablename); end loop;
end $$;

revoke all on public.reports, public.report_replies from anon;
revoke update, delete, truncate, references, trigger on public.reports from authenticated;
grant select, insert on public.reports to authenticated;
revoke all on public.report_replies from authenticated;
grant select on public.report_replies to authenticated;

create policy support_read_reports on public.reports for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_ticket_master()));
create policy support_create_own_reports on public.reports for insert to authenticated
with check (
  user_id = (select auth.uid()) and status = 'aberto' and closed_at is null
  and lower(user_email) = lower((select auth.jwt() ->> 'email'))
  and char_length(btrim(subject)) between 1 and 200
  and char_length(btrim(message)) between 1 and 10000
);
create policy support_read_replies on public.report_replies for select to authenticated
using (
  (select public.is_ticket_master()) or exists (
    select 1 from public.reports r where r.protocol_number = report_protocol and r.user_id = (select auth.uid())
  )
);

create or replace function public.answer_support_ticket(ticket_protocol bigint, reply_message text, finish_ticket boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_status text;
begin
  if not public.is_ticket_master() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if reply_message is null or char_length(btrim(reply_message)) not between 1 and 10000 then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  select status into current_status from public.reports where protocol_number = ticket_protocol for update;
  if not found then raise exception 'Ticket não encontrado.'; end if;
  if current_status = 'finalizado' then raise exception 'Reabra o ticket antes de responder.'; end if;
  insert into public.report_replies(report_protocol, author_id, message)
    values (ticket_protocol, auth.uid(), btrim(reply_message));
  update public.reports
    set status = case when finish_ticket then 'finalizado' else 'em_atendimento' end,
        closed_at = case when finish_ticket then now() else null end
    where protocol_number = ticket_protocol;
end $$;

create or replace function public.change_support_ticket_status(ticket_protocol bigint, new_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_ticket_master() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if new_status is null or new_status not in ('aberto', 'em_atendimento', 'finalizado') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  perform 1 from public.reports where protocol_number = ticket_protocol for update;
  if not found then raise exception 'Ticket não encontrado.'; end if;
  update public.reports set status = new_status,
    closed_at = case when new_status = 'finalizado' then coalesce(closed_at, now()) else null end
  where protocol_number = ticket_protocol;
end $$;
revoke all on function public.answer_support_ticket(bigint, text, boolean) from public, anon;
revoke all on function public.change_support_ticket_status(bigint, text) from public, anon;
grant execute on function public.answer_support_ticket(bigint, text, boolean) to authenticated;
grant execute on function public.change_support_ticket_status(bigint, text) to authenticated;

notify pgrst, 'reload schema';
commit;
