-- Run with the additive migration in the same transaction before publication.
-- Only synthetic savings for existing accounts; all changes rolled back.
begin;
create temporary table savings_test_users as select id, row_number() over(order by id) as n from auth.users order by id limit 2;
grant select on savings_test_users to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from savings_test_users where n=1),true);
do $$
declare result jsonb; request_id uuid := gen_random_uuid();
begin
  result := public.savings_account_action('read');
  if (result->>'balance_cents')::bigint <> 0 then raise exception 'Fixture account already has savings'; end if;
  result := public.savings_account_action('goal',10000,gen_random_uuid());
  result := public.savings_account_action('deposit',486,request_id);
  result := public.savings_account_action('deposit',486,request_id);
  if (result->>'balance_cents')::bigint <> 486 then raise exception 'Duplicate deposit'; end if;
  begin
    perform public.savings_account_action('deposit',487,request_id);
    raise exception 'Conflicting ID accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.savings_account_action('withdraw',487,gen_random_uuid());
    raise exception 'Overdraft accepted';
  exception when check_violation then null; end;
  result := public.savings_account_action('withdraw',86,gen_random_uuid());
  if (result->>'balance_cents')::bigint <> 400 then raise exception 'Wrong withdrawal'; end if;
  result := public.savings_account_action('deposit',9600,gen_random_uuid());
  if (result->>'balance_cents')::bigint <> (result->>'goal_cents')::bigint then raise exception 'Goal not reached'; end if;
  result := public.savings_account_action('goal',20000,gen_random_uuid());
  if (result->>'balance_cents')::bigint <> 10000 then raise exception 'Goal reset balance'; end if;
  begin
    perform public.savings_account_action('deposit',0,gen_random_uuid());
    raise exception 'Zero accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.savings_account_action('withdraw',-1,gen_random_uuid());
    raise exception 'Negative accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform 1 from app_private.savings_accounts;
    raise exception 'Direct access allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from savings_test_users where n=2),true);
do $$ declare result jsonb; begin
  result := public.savings_account_action('read');
  if result <> '{"balance_cents":0,"goal_cents":null}'::jsonb then raise exception 'Cross account leak'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claims','{}',true);
do $$ begin
  begin
    perform public.savings_account_action('read');
    raise exception 'Missing identity accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.savings_account_action('read');
    raise exception 'Anonymous access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
