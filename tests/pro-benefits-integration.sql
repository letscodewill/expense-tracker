-- Uses synthetic grants/reservations only. Always rollback in one connection.
begin;
create temporary table pro_test_context as
select (select u.id from auth.users u join public.support_owner o on o.user_id=u.id where lower(u.email)='williansantos38@gmail.com' and u.email_confirmed_at is not null) as owner_id,
  (select u.id from auth.users u where u.email_confirmed_at is not null and not exists(select 1 from public.support_owner o where o.user_id=u.id) order by u.id limit 1) as target_id,
  gen_random_uuid() as request_id;
grant select on pro_test_context to authenticated;
do $$ begin
  if exists(select 1 from pro_test_context where owner_id is null or target_id is null) then raise exception 'Requires master and a confirmed ordinary account'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from pro_test_context),true);
do $$
declare context record; plan jsonb;
begin
  select * into context from pro_test_context;
  plan:=public.get_my_plan();
  if plan->>'source'<>'master' or plan->>'plan'<>'pro' or (plan->>'can_manage_benefits')::boolean is not true then raise exception 'Missing master access'; end if;
  perform public.change_pro_courtesy('grant',context.target_id,now()+interval '14 days','Synthetic tester',0,context.request_id);
  perform public.change_pro_courtesy('grant',context.target_id,now()+interval '14 days','Synthetic tester',0,context.request_id);
  begin
    perform public.change_pro_courtesy('grant',context.target_id,null,'Different payload',0,context.request_id);
    raise exception 'Conflicting idempotency key accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.change_pro_courtesy('grant',context.target_id,null,'Stale update',0,gen_random_uuid());
    raise exception 'Stale revision accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.change_pro_courtesy('grant',context.target_id,now()-interval '1 day','Past date',1,gen_random_uuid());
    raise exception 'Past date accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.change_pro_courtesy('revoke',context.owner_id,null,'Remove master',0,gen_random_uuid());
    raise exception 'Master revoked';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select target_id::text from pro_test_context),true),set_config('request.jwt.claims','{"user_metadata":{"plan":"pro","is_master":true}}',true);
do $$ declare context record; plan jsonb; begin
  select * into context from pro_test_context;
  plan:=public.get_my_plan();
  if plan->>'source'<>'courtesy' or (plan->>'can_manage_benefits')::boolean then raise exception 'Courtesy authorization wrong'; end if;
  begin
    perform public.admin_pro_overview('',0);
    raise exception 'User read admin data';
  exception when insufficient_privilege then null; end;
  begin
    perform public.change_pro_courtesy('grant',context.target_id,null,'Self promotion',1,gen_random_uuid());
    raise exception 'Self promotion allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from app_private.pro_courtesies;
    raise exception 'Direct table access allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select owner_id::text from pro_test_context),true);
do $$ declare context record; data jsonb; begin
  select * into context from pro_test_context;
  data:=public.admin_pro_overview('',0);
  if not exists(select 1 from jsonb_array_elements(data->'users') u where u->>'id'=context.target_id::text and (u->'courtesy'->>'revision')::bigint=1) then raise exception 'Missing overview'; end if;
  if (select count(*) from jsonb_array_elements(data->'history') h where h->'after_value'->>'reason'='Synthetic tester')<>1 then raise exception 'Audit duplicated'; end if;
  perform public.change_pro_courtesy('grant',context.target_id,null,'Permanent tester',1,gen_random_uuid());
end $$;
select set_config('request.jwt.claim.sub',(select target_id::text from pro_test_context),true);
do $$ begin if public.get_my_plan()->>'plan'<>'pro' or public.get_my_plan()->>'expires_at' is not null then raise exception 'Permanent benefit failed'; end if; end $$;
select set_config('request.jwt.claim.sub',(select owner_id::text from pro_test_context),true);
do $$ begin perform public.change_pro_courtesy('revoke',(select target_id from pro_test_context),null,'End test',2,gen_random_uuid()); end $$;
select set_config('request.jwt.claim.sub',(select target_id::text from pro_test_context),true);
do $$ begin if public.get_my_plan()->>'plan'<>'free' then raise exception 'Revocation failed'; end if; end $$;
reset role;
-- Expiration applies at read time, with no scheduler or token refresh needed.
update app_private.pro_courtesies set revoked_at=null,expires_at=now()-interval '1 minute' where user_id=(select target_id from pro_test_context);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select target_id::text from pro_test_context),true);
do $$ begin if public.get_my_plan()->>'plan'<>'free' then raise exception 'Expired benefit accepted'; end if; end $$;
reset role;
insert into app_private.invoice_ai_reservations(user_id,period,state)
select c.id,date_trunc('month',now() at time zone 'America/Sao_Paulo')::date,'succeeded'
from (select owner_id as id from pro_test_context union all select target_id from pro_test_context) c cross join generate_series(1,4);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from pro_test_context),true);
do $$ begin if not (public.reserve_invoice_ai()->>'allowed')::boolean then raise exception 'Master still has monthly quota'; end if; end $$;
select set_config('request.jwt.claim.sub',(select target_id::text from pro_test_context),true);
do $$ begin if (public.reserve_invoice_ai()->>'allowed')::boolean then raise exception 'Regular monthly quota removed'; end if; end $$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$ begin
  begin perform public.get_my_plan(); raise exception 'Missing identity allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.get_my_plan(); raise exception 'Anonymous allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
