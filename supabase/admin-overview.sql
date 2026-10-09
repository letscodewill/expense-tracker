-- Master-only account metrics. No financial values or authentication secrets are returned.
begin;
create schema if not exists app_private;
create table if not exists app_private.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz,
  last_action timestamptz
);
alter table app_private.user_activity enable row level security;
revoke all on app_private.user_activity from public, anon, authenticated;
create index if not exists user_activity_seen_idx on app_private.user_activity(last_seen);
create index if not exists user_activity_action_idx on app_private.user_activity(last_action);

-- Existing expense creation dates provide historical activity, not historical visits.
insert into app_private.user_activity(user_id,last_action)
select e.user_id, max(e.created_at at time zone 'UTC') from public.expenses e
join auth.users u on u.id=e.user_id
where e.represents_board_id is null group by e.user_id
on conflict(user_id) do update set last_action=greatest(app_private.user_activity.last_action,excluded.last_action);

create or replace function app_private.record_user_visit()
returns boolean language plpgsql security definer set search_path=''
as $$
declare account_id uuid := auth.uid();
begin
  if account_id is null then return false; end if;
  insert into app_private.user_activity(user_id,last_seen) values(account_id,now())
  on conflict(user_id) do update set last_seen=excluded.last_seen
  where app_private.user_activity.last_seen is null or app_private.user_activity.last_seen < now()-interval '5 minutes';
  return true;
end;
$$;

create or replace function public.record_user_visit()
returns boolean language sql security invoker set search_path=''
as $$ select app_private.record_user_visit(); $$;

create or replace function app_private.record_expense_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare account_id uuid := auth.uid();
begin
  if account_id is null then return coalesce(new,old); end if;
  if coalesce(new.user_id,old.user_id) <> account_id or coalesce(new.represents_board_id,old.represents_board_id) is not null then return coalesce(new,old); end if;
  insert into app_private.user_activity(user_id,last_action) values(account_id,now())
  on conflict(user_id) do update set last_action=excluded.last_action
  where app_private.user_activity.last_action is null or app_private.user_activity.last_action < now()-interval '1 minute';
  return coalesce(new,old);
end;
$$;
drop trigger if exists record_expense_activity on public.expenses;
create trigger record_expense_activity after insert or update or delete on public.expenses
for each row execute function app_private.record_expense_activity();

create or replace function app_private.get_admin_overview(page_offset integer default 0,search_value text default '')
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare summary jsonb; account_rows jsonb; matching_count bigint;
begin
  if not public.is_support_owner() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if page_offset is null or page_offset < 0 or page_offset > 100000 or search_value is null or char_length(search_value)>100 then raise exception 'Busca inválida.' using errcode='22023'; end if;
  select jsonb_build_object(
    'registered',count(*),
    'confirmed',count(*) filter(where u.email_confirmed_at is not null),
    'active7',count(*) filter(where greatest(a.last_seen,u.last_sign_in_at)>=now()-interval '7 days'),
    'active30',count(*) filter(where greatest(a.last_seen,u.last_sign_in_at)>=now()-interval '30 days'),
    'used30',count(*) filter(where a.last_action>=now()-interval '30 days'),
    'new30',count(*) filter(where u.created_at>=now()-interval '30 days')) into summary
  from auth.users u left join app_private.user_activity a on a.user_id=u.id where not coalesce(u.is_anonymous,false);
  select count(*) into matching_count from auth.users u where not coalesce(u.is_anonymous,false)
    and strpos(lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')),lower(btrim(search_value)))>0;
  select coalesce(jsonb_agg(to_jsonb(accounts)),'[]'::jsonb) into account_rows from (
    select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name','') as name,u.created_at,
      (u.email_confirmed_at is not null) as confirmed,greatest(a.last_seen,u.last_sign_in_at) as last_access,a.last_action
    from auth.users u left join app_private.user_activity a on a.user_id=u.id
    where not coalesce(u.is_anonymous,false)
      and strpos(lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')),lower(btrim(search_value)))>0
    order by u.created_at desc,u.id limit 50 offset page_offset
  ) accounts;
  return jsonb_build_object('summary',summary,'users',account_rows,'matching',matching_count);
end;
$$;
create or replace function public.get_admin_overview(page_offset integer default 0,search_value text default '')
returns jsonb language sql stable security invoker set search_path=''
as $$ select app_private.get_admin_overview(page_offset,search_value); $$;

revoke all on function app_private.record_user_visit(),app_private.record_expense_activity(),app_private.get_admin_overview(integer,text),public.record_user_visit(),public.get_admin_overview(integer,text) from public,anon,authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.record_user_visit(),app_private.get_admin_overview(integer,text),public.record_user_visit(),public.get_admin_overview(integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
