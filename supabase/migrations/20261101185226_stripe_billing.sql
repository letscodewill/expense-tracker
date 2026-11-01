begin;
create table app_private.billing_settings(id boolean primary key default true check(id), enabled boolean not null default false);
insert into app_private.billing_settings(id,enabled) values(true,false);
create table app_private.billing_customers(
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer text unique not null check(customer ~ '^cus_'), session text,
  lock_token uuid, lock_until timestamptz,
  created_at timestamptz not null default now()
);
create table app_private.billing_subscriptions(
  id text primary key check(id ~ '^sub_'),
  user_id uuid not null references app_private.billing_customers(user_id) on delete cascade,
  status text not null, price text not null, period_end timestamptz,
  cancel_at_period_end boolean not null default false, updated_at timestamptz not null default now()
);
create index billing_subscriptions_user_idx on app_private.billing_subscriptions(user_id);
create table app_private.billing_events(id text primary key, user_id uuid references auth.users(id) on delete set null, processed_at timestamptz not null default now());
create index billing_events_user_idx on app_private.billing_events(user_id);
alter table app_private.billing_settings enable row level security;
alter table app_private.billing_customers enable row level security;
alter table app_private.billing_subscriptions enable row level security;
alter table app_private.billing_events enable row level security;
revoke all on app_private.billing_settings,app_private.billing_customers,app_private.billing_subscriptions,app_private.billing_events from public,anon,authenticated;

create function public.billing_customer(user_input uuid) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('customer',customer) from app_private.billing_customers where user_id=user_input;
$$;
create function public.billing_register_customer(user_input uuid,customer_input text) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if customer_input is null or customer_input !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid customer'; end if;
  insert into app_private.billing_customers(user_id,customer) values(user_input,customer_input) on conflict(user_id) do nothing;
  if not exists(select 1 from app_private.billing_customers where user_id=user_input and customer=customer_input) then raise exception 'Customer binding mismatch'; end if;
  return true;
end $$;
create function public.billing_claim(customer_input text,event_input text) returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid; token uuid:=gen_random_uuid(); previous_session text;
begin
  select user_id into account from app_private.billing_customers where customer=customer_input;
  if account is null then return jsonb_build_object('ignored',true); end if;
  if event_input is not null and exists(select 1 from app_private.billing_events where id=event_input) then return jsonb_build_object('duplicate',true); end if;
  update app_private.billing_customers set lock_token=token,lock_until=clock_timestamp()+interval '2 minutes'
    where user_id=account and (lock_until is null or lock_until<clock_timestamp()) returning session into previous_session;
  if not found then return jsonb_build_object('busy',true); end if;
  return jsonb_build_object('token',token,'session',previous_session);
end $$;
create function public.billing_release(token_input uuid) returns boolean language plpgsql security definer set search_path='' as $$ begin
  update app_private.billing_customers set lock_token=null,lock_until=null where lock_token=token_input;
  return found;
end $$;
create function public.billing_save_session(token_input uuid,session_input text) returns boolean language plpgsql security definer set search_path='' as $$ begin
  if session_input is null or session_input !~ '^cs_' then raise exception 'Invalid session'; end if;
  update app_private.billing_customers set session=session_input where lock_token=token_input and lock_until>clock_timestamp();
  return found;
end $$;
create function public.billing_commit(customer_input text,event_input text,token_input uuid,subscriptions_input jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare account uuid; item jsonb;
begin
  select user_id into account from app_private.billing_customers
    where customer=customer_input and lock_token=token_input and lock_until>clock_timestamp() for update;
  if account is null then raise exception 'Expired billing lock'; end if;
  if event_input is null or char_length(event_input)>255 or jsonb_typeof(subscriptions_input)<>'array' or jsonb_array_length(subscriptions_input)>1000 then raise exception 'Invalid billing snapshot'; end if;
  if exists(select 1 from app_private.billing_events where id=event_input) then return true; end if;
  -- Replace only this customer's snapshot, fetched from Stripe while holding the lease.
  -- Older/out-of-order events also fetch the current state instead of replaying old payloads.
  delete from app_private.billing_subscriptions where user_id=account;
  for item in select value from jsonb_array_elements(subscriptions_input) loop
    insert into app_private.billing_subscriptions(id,user_id,status,price,period_end,cancel_at_period_end)
      values(item->>'id',account,item->>'status',item->>'price',(item->>'period_end')::timestamptz,coalesce((item->>'cancel_at_period_end')::boolean,false));
  end loop;
  insert into app_private.billing_events(id,user_id) values(event_input,account);
  return true;
end $$;
revoke all on function public.billing_customer(uuid),public.billing_register_customer(uuid,text),public.billing_claim(text,text),public.billing_release(uuid),public.billing_save_session(uuid,text),public.billing_commit(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.billing_customer(uuid),public.billing_register_customer(uuid,text),public.billing_claim(text,text),public.billing_release(uuid),public.billing_save_session(uuid,text),public.billing_commit(text,text,uuid,jsonb) to service_role;

create or replace function app_private.get_my_plan() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); courtesy app_private.pro_courtesies%rowtype; paid_until timestamptz;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  if public.is_support_owner() then return jsonb_build_object('plan','pro','source','master','expires_at',null,'can_manage_benefits',true); end if;
  select * into courtesy from app_private.pro_courtesies where user_id=account_id;
  if found and courtesy.revoked_at is null and (courtesy.expires_at is null or courtesy.expires_at>now()) then
    return jsonb_build_object('plan','pro','source','courtesy','expires_at',courtesy.expires_at,'can_manage_benefits',false);
  end if;
  select max(period_end) into paid_until from app_private.billing_subscriptions where user_id=account_id and status='active' and period_end>now();
  if paid_until is not null then return jsonb_build_object('plan','pro','source','subscription','expires_at',paid_until,'can_manage_benefits',false); end if;
  return jsonb_build_object('plan','free','source','default','expires_at',null,'can_manage_benefits',false);
end $$;
create function public.get_my_billing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  return jsonb_build_object('has_customer',exists(select 1 from app_private.billing_customers where user_id=auth.uid()),
    'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('status',status,'period_end',period_end,'cancel_at_period_end',cancel_at_period_end))
      from app_private.billing_subscriptions where user_id=auth.uid() and status not in ('canceled','incomplete_expired')),'[]'::jsonb),
    'limits_enabled',(select enabled from app_private.billing_settings where id));
end $$;
revoke all on function public.get_my_billing() from public,anon;
grant execute on function public.get_my_billing() to authenticated;

-- Atomic limit enforced for direct API writes and for boards created by imports/moves.
create function app_private.enforce_free_boards() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not (select enabled from app_private.billing_settings where id) then return new; end if;
  if tg_op='UPDATE' and (new.user_id,new.month,new.year) is not distinct from (old.user_id,old.month,old.year) then return new; end if;
  if new.user_id is distinct from auth.uid() then raise exception 'Quadro indisponível.' using errcode='42501'; end if;
  if app_private.get_my_plan()->>'plan'='pro' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('board-limit:'||new.user_id::text,0));
  if (select count(*) from public.boards where user_id=new.user_id and month=new.month and year=new.year and id<>new.id)>=2 then
    raise exception 'O plano Free permite até 2 quadros por mês. Conheça o Pro.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function app_private.enforce_free_boards() from public,anon,authenticated;
create trigger enforce_free_boards before insert or update of user_id,month,year on public.boards for each row execute function app_private.enforce_free_boards();

create or replace function app_private.reserve_invoice_ai() returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); month_start date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  occupied integer; completed integer; reservation uuid; quota integer:=4; lifetime boolean:=false;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  if public.is_support_owner() then quota:=null;
  elsif (select enabled from app_private.billing_settings where id) and app_private.get_my_plan()->>'plan'<>'pro' then quota:=2; lifetime:=true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai-quota:'||account_id::text,0));
  select count(*) filter(where state='succeeded'),count(*) filter(where state='succeeded' or (state='pending' and expires_at>now())) into completed,occupied
    from app_private.invoice_ai_reservations where user_id=account_id and (lifetime or period=month_start);
  if quota is not null and occupied>=quota then return jsonb_build_object('allowed',false,'used',completed,'limit',quota,'period',month_start,'lifetime',lifetime); end if;
  if (select count(*) from app_private.invoice_ai_reservations where user_id=account_id and created_at>now()-interval '1 hour')>=20 then
    return jsonb_build_object('allowed',false,'reason','rate','used',completed,'limit',quota,'period',month_start,'lifetime',lifetime);
  end if;
  insert into app_private.invoice_ai_reservations(user_id,period) values(account_id,month_start) returning token into reservation;
  return jsonb_build_object('allowed',true,'token',reservation,'used',completed,'limit',quota,'period',month_start,'lifetime',lifetime);
end $$;
notify pgrst,'reload schema';
commit;
