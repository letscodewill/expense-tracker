create table app_private.pro_courtesies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz,
  reason text not null check(char_length(btrim(reason)) between 1 and 300),
  revoked_at timestamptz,
  revision bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table app_private.pro_courtesy_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  actor_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('grant','revoke')),
  payload jsonb not null,
  before_value jsonb,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
create index pro_courtesy_audit_user_created_idx on app_private.pro_courtesy_audit(user_id,created_at desc);
create index pro_courtesy_audit_actor_idx on app_private.pro_courtesy_audit(actor_id);
create index pro_courtesies_updated_by_idx on app_private.pro_courtesies(updated_by);
alter table app_private.pro_courtesies enable row level security;
alter table app_private.pro_courtesy_audit enable row level security;
revoke all on app_private.pro_courtesies,app_private.pro_courtesy_audit from public,anon,authenticated;
revoke all on sequence app_private.pro_courtesy_audit_id_seq from public,anon,authenticated;

create function app_private.get_my_plan()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); courtesy app_private.pro_courtesies%rowtype;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  if public.is_support_owner() then
    return jsonb_build_object('plan','pro','source','master','expires_at',null,'can_manage_benefits',true);
  end if;
  select * into courtesy from app_private.pro_courtesies where user_id=account_id;
  if found and courtesy.revoked_at is null and (courtesy.expires_at is null or courtesy.expires_at>now()) then
    return jsonb_build_object('plan','pro','source','courtesy','expires_at',courtesy.expires_at,'can_manage_benefits',false);
  end if;
  return jsonb_build_object('plan','free','source','default','expires_at',null,'can_manage_benefits',false);
end $$;

create function app_private.admin_pro_overview(search_input text, offset_input integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_support_owner() then raise exception 'Acesso permitido somente ao proprietário.' using errcode='42501'; end if;
  if search_input is null or char_length(search_input)>100 or offset_input is null or offset_input<0 or offset_input>100000 then
    raise exception 'Busca inválida.' using errcode='22023';
  end if;
  with matching as (
    select u.id,u.email,u.created_at,u.email_confirmed_at,
      coalesce(u.raw_user_meta_data->>'full_name','') as name,
      (lower(u.email)='williansantos38@gmail.com' and u.email_confirmed_at is not null and exists(select 1 from public.support_owner o where o.user_id=u.id)) as is_master,
      case when c.user_id is null then null else to_jsonb(c)-'user_id' end as courtesy
    from auth.users u left join app_private.pro_courtesies c on c.user_id=u.id
    where search_input='' or strpos(lower(coalesce(u.email,'')),lower(btrim(search_input)))>0
  ), page as (select * from matching order by (courtesy is not null) desc,created_at desc,id limit 20 offset offset_input)
  select jsonb_build_object('users',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from page p),
    'total',(select count(*) from matching),
    'history',(select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) from (
      select a.id,a.action,a.created_at,u.email as user_email,actor.email as actor_email,
        a.before_value,a.after_value
      from app_private.pro_courtesy_audit a left join auth.users u on u.id=a.user_id left join auth.users actor on actor.id=a.actor_id
      where search_input='' or strpos(lower(coalesce(u.email,'')),lower(btrim(search_input)))>0
      order by a.created_at desc,a.id desc limit 20
    ) h)) into result;
  return result;
end $$;

create function app_private.change_pro_courtesy(action_input text,user_input uuid,expires_input timestamptz,reason_input text,revision_input bigint,request_input uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_row app_private.pro_courtesies%rowtype;
  old_value jsonb; new_value jsonb; requested jsonb; previous_request app_private.pro_courtesy_audit%rowtype;
begin
  if actor is null or not public.is_support_owner() then raise exception 'Acesso permitido somente ao proprietário.' using errcode='42501'; end if;
  if action_input is null or action_input not in ('grant','revoke') or user_input is null or request_input is null or revision_input is null or revision_input<0
    or reason_input is null or char_length(btrim(reason_input)) not between 1 and 300 then
    raise exception 'Dados inválidos.' using errcode='22023';
  end if;
  if exists(select 1 from public.support_owner where user_id=user_input) then
    raise exception 'O acesso master é permanente e não pode ser alterado por cortesia.' using errcode='22023';
  end if;
  requested:=jsonb_build_object('action',action_input,'user_id',user_input,'expires_at',expires_input,'reason',btrim(reason_input),'revision',revision_input);
  -- Both a target lock and request lock: retries cannot duplicate audit events,
  -- and two administrator tabs cannot overwrite a stale revision.
  perform pg_advisory_xact_lock(hashtextextended('pro-request:'||request_input::text,0));
  select * into previous_request from app_private.pro_courtesy_audit where request_id=request_input;
  if found then
    if previous_request.actor_id is distinct from actor or previous_request.payload<>requested then
      raise exception 'Operação repetida com dados diferentes.' using errcode='22023';
    end if;
    return true;
  end if;
  if action_input='grant' and expires_input is not null and (not isfinite(expires_input) or expires_input<=now()) then
    raise exception 'Escolha uma validade futura ou sem vencimento.' using errcode='22023';
  end if;
  perform 1 from auth.users where id=user_input and email_confirmed_at is not null for key share;
  if not found then raise exception 'Conta confirmada não encontrada.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pro-target:'||user_input::text,0));
  select * into current_row from app_private.pro_courtesies where user_id=user_input for update;
  if coalesce(current_row.revision,0)<>revision_input then
    raise exception 'O benefício foi alterado. Atualize a página antes de continuar.' using errcode='40001';
  end if;
  old_value:=case when current_row.user_id is null then null else to_jsonb(current_row)-'user_id' end;
  if action_input='revoke' then
    if current_row.user_id is null or current_row.revoked_at is not null then raise exception 'Não há cortesia para revogar.' using errcode='22023'; end if;
    update app_private.pro_courtesies set revoked_at=now(),reason=btrim(reason_input),revision=revision+1,updated_at=now(),updated_by=actor where user_id=user_input;
  else
    insert into app_private.pro_courtesies(user_id,expires_at,reason,updated_by)
      values(user_input,expires_input,btrim(reason_input),actor)
    on conflict(user_id) do update set expires_at=excluded.expires_at,reason=excluded.reason,revoked_at=null,
      revision=app_private.pro_courtesies.revision+1,updated_at=now(),updated_by=actor;
  end if;
  select to_jsonb(c)-'user_id' into new_value from app_private.pro_courtesies c where user_id=user_input;
  insert into app_private.pro_courtesy_audit(request_id,actor_id,user_id,action,payload,before_value,after_value)
    values(request_input,actor,user_input,action_input,requested,old_value,new_value);
  return true;
end $$;

create function public.get_my_plan() returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.get_my_plan(); $$;
create function public.admin_pro_overview(search_input text default '',offset_input integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.admin_pro_overview(search_input,offset_input); $$;
create function public.change_pro_courtesy(action_input text,user_input uuid,expires_input timestamptz,reason_input text,revision_input bigint,request_input uuid)
returns boolean language sql security invoker set search_path='' as $$ select app_private.change_pro_courtesy(action_input,user_input,expires_input,reason_input,revision_input,request_input); $$;
revoke all on function app_private.get_my_plan(),app_private.admin_pro_overview(text,integer),app_private.change_pro_courtesy(text,uuid,timestamptz,text,bigint,uuid),
  public.get_my_plan(),public.admin_pro_overview(text,integer),public.change_pro_courtesy(text,uuid,timestamptz,text,bigint,uuid) from public,anon,authenticated;
grant execute on function app_private.get_my_plan(),app_private.admin_pro_overview(text,integer),app_private.change_pro_courtesy(text,uuid,timestamptz,text,bigint,uuid),
  public.get_my_plan(),public.admin_pro_overview(text,integer),public.change_pro_courtesy(text,uuid,timestamptz,text,bigint,uuid) to authenticated;
-- Schema is not exposed through the Data API; tables remain inaccessible.
grant usage on schema app_private to authenticated;

-- Master may test AI without a monthly product quota. Hourly anti-abuse stays.
create or replace function app_private.reserve_invoice_ai()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare account_id uuid:=auth.uid(); month_start date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  occupied integer; completed integer; reservation uuid;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text||month_start::text,0));
  select count(*) filter(where state='succeeded'),count(*) filter(where state='succeeded' or (state='pending' and expires_at>now()))
    into completed,occupied from app_private.invoice_ai_reservations where user_id=account_id and period=month_start;
  if occupied>=4 and not public.is_support_owner() then return jsonb_build_object('allowed',false,'used',completed,'limit',case when public.is_support_owner() then null else 4 end,'period',month_start); end if;
  -- Limit direct RPC spam too; no reservation metadata is readable by app accounts.
  if (select count(*) from app_private.invoice_ai_reservations where user_id=account_id and created_at>now()-interval '1 hour')>=20 then
    return jsonb_build_object('allowed',false,'reason','rate','used',completed,'limit',case when public.is_support_owner() then null else 4 end,'period',month_start);
  end if;
  insert into app_private.invoice_ai_reservations(user_id,period) values(account_id,month_start) returning token into reservation;
  return jsonb_build_object('allowed',true,'token',reservation,'used',completed,'limit',case when public.is_support_owner() then null else 4 end,'period',month_start);
end;
$$;
