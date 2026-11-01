begin;
create table app_private.savings_goals(
  id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 80),
  balance_cents bigint not null default 0 check(balance_cents between 0 and 99999999999),
  goal_cents bigint check(goal_cents between 1 and 99999999999),created_at timestamptz not null default now()
);
create index savings_goals_user_idx on app_private.savings_goals(user_id);
create table app_private.savings_goal_operations(
  goal_id uuid not null references app_private.savings_goals(id) on delete cascade,request_id uuid not null,
  action text not null check(action in ('goal','deposit','withdraw')),amount_cents bigint not null,
  created_at timestamptz not null default now(),primary key(goal_id,request_id)
);
alter table app_private.savings_goals enable row level security;
alter table app_private.savings_goal_operations enable row level security;
revoke all on app_private.savings_goals,app_private.savings_goal_operations from public,anon,authenticated;
create function app_private.savings_extra_action(action_input text,goal_input uuid,amount_input bigint,request_input uuid,name_input text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid:=auth.uid(); goal app_private.savings_goals%rowtype; previous app_private.savings_goal_operations%rowtype;
begin
  if account is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  if action_input='list' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.created_at,g.id) from app_private.savings_goals g where user_id=account),'[]'::jsonb);
  end if;
  if action_input='create' then
    if goal_input is null or name_input is null or char_length(btrim(name_input)) not between 1 and 80 then raise exception 'Dados inválidos.' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('savings-goals:'||account::text,0));
    select * into goal from app_private.savings_goals where id=goal_input;
    if found then
      if goal.user_id<>account or goal.name<>btrim(name_input) then raise exception 'Operação repetida com dados diferentes.' using errcode='22023'; end if;
      return to_jsonb(goal)-'user_id';
    end if;
    if app_private.get_my_plan()->>'plan'<>'pro' then raise exception 'Várias metas estão disponíveis no Pro.' using errcode='42501'; end if;
    insert into app_private.savings_goals(id,user_id,name) values(goal_input,account,btrim(name_input)) returning * into goal;
    return to_jsonb(goal)-'user_id';
  end if;
  if action_input is null or action_input not in ('read','goal','deposit','withdraw') then raise exception 'Operação inválida.' using errcode='22023'; end if;
  select * into goal from app_private.savings_goals where id=goal_input and user_id=account for update;
  if not found then raise exception 'Meta indisponível.' using errcode='42501'; end if;
  if action_input<>'read' then
    if request_input is null or amount_input is null or amount_input not between 1 and 99999999999 then raise exception 'Dados inválidos.' using errcode='22023'; end if;
    select * into previous from app_private.savings_goal_operations where goal_id=goal_input and request_id=request_input;
    if found then
      if previous.action<>action_input or previous.amount_cents<>amount_input then raise exception 'Operação repetida com dados diferentes.' using errcode='22023'; end if;
    else
      if action_input='goal' then goal.goal_cents:=amount_input;
      elsif action_input='deposit' then
        if goal.balance_cents>99999999999-amount_input then raise exception 'O saldo ultrapassaria o limite permitido.' using errcode='23514'; end if;
        goal.balance_cents:=goal.balance_cents+amount_input;
      else
        if amount_input>goal.balance_cents then raise exception 'O valor da retirada é maior que o saldo do cofrinho.' using errcode='23514'; end if;
        goal.balance_cents:=goal.balance_cents-amount_input;
      end if;
      update app_private.savings_goals set balance_cents=goal.balance_cents,goal_cents=goal.goal_cents where id=goal_input and user_id=account;
      insert into app_private.savings_goal_operations(goal_id,request_id,action,amount_cents) values(goal_input,request_input,action_input,amount_input);
    end if;
  end if;
  return jsonb_build_object('balance_cents',goal.balance_cents,'goal_cents',goal.goal_cents);
end $$;
create function public.savings_extra_action(action_input text,goal_input uuid default null,amount_input bigint default null,request_input uuid default null,name_input text default null)
returns jsonb language sql security invoker set search_path='' as $$ select app_private.savings_extra_action(action_input,goal_input,amount_input,request_input,name_input); $$;
revoke all on function app_private.savings_extra_action(text,uuid,bigint,uuid,text),public.savings_extra_action(text,uuid,bigint,uuid,text) from public,anon;
grant execute on function app_private.savings_extra_action(text,uuid,bigint,uuid,text),public.savings_extra_action(text,uuid,bigint,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
