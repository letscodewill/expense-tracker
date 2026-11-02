-- Synthetic accounts, billing, expenses and goals. Always roll back in one connection.
begin;
create temporary table billing_test_context as select gen_random_uuid() account,gen_random_uuid() other,gen_random_uuid() goal,gen_random_uuid() request;
grant select on billing_test_context to authenticated,service_role;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role)
select account,account::text||'@billing-test.invalid',now(),'{}'::jsonb,'{}'::jsonb,'authenticated','authenticated' from billing_test_context
union all select other,other::text||'@billing-test.invalid',now(),'{}'::jsonb,'{}'::jsonb,'authenticated','authenticated' from billing_test_context;
update app_private.billing_settings set enabled=true;
set local role service_role;
select public.billing_register_customer(account,'cus_BillingTest'||replace(account::text,'-','')) from billing_test_context;
do $$ declare c record; lock jsonb; begin
  select * into c from billing_test_context;
  lock:=public.billing_claim('cus_BillingTest'||replace(c.account::text,'-',''),'evt_test_paid');
  if lock->>'token' is null then raise exception 'FAIL: claim'; end if;
  if (public.billing_claim('cus_BillingTest'||replace(c.account::text,'-',''),'evt_other')->>'busy')::boolean is not true then raise exception 'FAIL: concurrent claim'; end if;
  begin
    perform public.billing_commit('cus_BillingTest'||replace(c.account::text,'-',''),'evt_test_paid',gen_random_uuid(),'[]');
    raise exception 'FAIL: stale lock accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  perform public.billing_commit('cus_BillingTest'||replace(c.account::text,'-',''),'evt_test_paid',(lock->>'token')::uuid,
    jsonb_build_array(jsonb_build_object('id','sub_BillingTest','status','active','price','price_BillingTest','period_end',now()+interval '1 month','cancel_at_period_end',true)));
  perform public.billing_release((lock->>'token')::uuid);
  if (public.billing_claim('cus_BillingTest'||replace(c.account::text,'-',''),'evt_test_paid')->>'duplicate')::boolean is not true then raise exception 'FAIL: duplicate event'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',account::text,true) from billing_test_context;
set local role authenticated;
do $$ declare c record; r jsonb; begin
  select * into c from billing_test_context;
  if public.get_my_plan()->>'source'<>'subscription' then raise exception 'FAIL: paid plan'; end if;
  begin
    perform public.billing_register_customer(c.account,'cus_Forged');
    raise exception 'FAIL: client changed billing' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from app_private.billing_subscriptions;
    raise exception 'FAIL: client read billing table' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  perform public.savings_extra_action('create',c.goal,null,null,'Synthetic travel');
  perform public.savings_extra_action('deposit',c.goal,486,c.request);
  r:=public.savings_extra_action('deposit',c.goal,486,c.request);
  if (r->>'balance_cents')::integer<>486 then raise exception 'FAIL: duplicate deposit'; end if;
  perform public.savings_extra_action('goal',c.goal,486,gen_random_uuid());
  begin
    perform public.savings_extra_action('withdraw',c.goal,487,gen_random_uuid());
    raise exception 'FAIL: overdraft' using errcode='XX000';
  exception when check_violation then null; end;
  if jsonb_array_length(public.savings_extra_action('list'))<>1 then raise exception 'FAIL: goal list'; end if;
end $$;
reset role;
update app_private.billing_subscriptions set status='past_due' where id='sub_BillingTest';
insert into app_private.invoice_ai_reservations(user_id,period,state)
select account,(date_trunc('month',now() at time zone 'America/Sao_Paulo')-interval '1 month')::date,'succeeded' from billing_test_context;
set local role authenticated;
do $$ declare c record; r jsonb; begin
  select * into c from billing_test_context;
  if public.get_my_plan()->>'plan'<>'free' then raise exception 'FAIL: past due kept paid access'; end if;
  begin
    perform public.savings_extra_action('create',gen_random_uuid(),null,null,'Blocked new goal');
    raise exception 'FAIL: free created extra goal' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  -- Downgrading preserves existing goals and balances.
  r:=public.savings_extra_action('read',c.goal);
  if (r->>'balance_cents')::integer<>486 then raise exception 'FAIL: downgrade lost savings'; end if;
  insert into public.boards(user_id,name,month,year) values(c.account,'Synthetic one',0,2199);
  begin
    insert into public.boards(user_id,name,month,year) values(c.account,'Blocked second',0,2199);
    raise exception 'FAIL: free created second board' using errcode='XX000';
  exception when check_violation then null; end;
  insert into public.boards(user_id,name,month,year) values(c.account,'Next month',1,2199);
  r:=public.reserve_invoice_ai();
  if (r->>'allowed')::boolean is not true then raise exception 'FAIL: previous month consumed current quota'; end if;
  perform public.finish_invoice_ai((r->>'token')::uuid,false);
  r:=public.reserve_invoice_ai();
  if (r->>'allowed')::boolean is not true then raise exception 'FAIL: failed analysis consumed quota'; end if;
  if (public.reserve_invoice_ai()->>'allowed')::boolean then raise exception 'FAIL: pending analysis did not reserve slot'; end if;
  perform public.finish_invoice_ai((r->>'token')::uuid,true);
  r:=public.reserve_invoice_ai();
  if (r->>'allowed')::boolean or (r->>'limit')::integer<>1 or (r->>'lifetime')::boolean is not false then raise exception 'FAIL: free monthly AI quota'; end if;
end $$;
reset role;
-- A valid courtesy remains Pro independently of subscription failures.
insert into app_private.pro_courtesies(user_id,reason) select account,'Synthetic courtesy' from billing_test_context;
set local role authenticated;
do $$ declare r jsonb; begin
  if public.get_my_plan()->>'source'<>'courtesy' then raise exception 'FAIL: courtesy overwritten'; end if;
  for i in 1..9 loop
    r:=public.reserve_invoice_ai();
    if (r->>'allowed')::boolean is not true or (r->>'limit')::integer<>10 then raise exception 'FAIL: Pro quota changed'; end if;
    perform public.finish_invoice_ai((r->>'token')::uuid,true);
  end loop;
  if (public.reserve_invoice_ai()->>'allowed')::boolean then raise exception 'FAIL: Pro exceeded ten analyses'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',other::text,true) from billing_test_context;
set local role authenticated;
do $$ declare c record; begin
  select * into c from billing_test_context;
  if public.get_my_plan()->>'plan'<>'free' then raise exception 'FAIL: paid access leaked'; end if;
  if jsonb_array_length(public.savings_extra_action('list'))<>0 then raise exception 'FAIL: foreign goal visible'; end if;
  begin
    perform public.savings_extra_action('read',c.goal);
    raise exception 'FAIL: foreign goal accessible' using errcode='XX000';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.get_my_billing()','execute') or has_function_privilege('authenticated','public.billing_commit(text,text,uuid,jsonb)','execute') then raise exception 'FAIL: billing grants'; end if;
end $$;
rollback;
select 'PASS: subscription access, courtesy precedence, account isolation, duplicate and concurrent events, stale locks, free monthly board and AI limits, multiple goals, duplicate deposits, overdraft and downgrade preservation' result;
