begin;
create temporary table budget_test_users(owner_id uuid, other_id uuid);
insert into budget_test_users select (select id from auth.users order by id limit 1),(select id from auth.users order by id offset 1 limit 1);
grant select on budget_test_users to authenticated;
insert into public.category_budgets(user_id,month,category,amount) select other_id,date '2099-11-01','Mercado',300 from budget_test_users;
insert into public.reminder_preferences(user_id,browser_enabled,days_before) select other_id,true,7 from budget_test_users on conflict(user_id) do update set browser_enabled=true,days_before=7;
select set_config('request.jwt.claim.sub',owner_id::text,true) from budget_test_users;
set local role authenticated;
do $$ declare own uuid; other uuid; begin
  select owner_id,other_id into own,other from budget_test_users;
  if own is null or other is null then raise exception 'Missing test users'; end if;
  insert into public.category_budgets(user_id,month,category,amount) values(own,'2099-11-01','Mercado',100);
  update public.category_budgets set amount=150 where user_id=own and month='2099-11-01';
  if (select amount from public.category_budgets where user_id=own and month='2099-11-01') <> 150 then raise exception 'Own budget update failed'; end if;
  if exists(select 1 from public.category_budgets where user_id=other) then raise exception 'Foreign budgets visible'; end if;
  if exists(select 1 from public.reminder_preferences where user_id=other) then raise exception 'Foreign preferences visible'; end if;
  update public.category_budgets set amount=999 where user_id=other;
  if found then raise exception 'Foreign budget changed'; end if;
  delete from public.reminder_preferences where user_id=other;
  if found then raise exception 'Foreign preferences deleted'; end if;
  begin
    insert into public.category_budgets(user_id,month,category,amount) values(other,'2099-12-01','Lazer',10);
    raise exception 'Foreign budget insertion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.category_budgets set user_id=other where user_id=own;
    raise exception 'Budget ownership changed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.category_budgets(user_id,month,category,amount) values(own,'2099-12-01','Lazer',-1);
    raise exception 'Negative limit accepted';
  exception when check_violation then null; end;
  insert into public.reminder_preferences(user_id,browser_enabled,days_before) values(own,true,3) on conflict(user_id) do update set browser_enabled=true,days_before=3;
  if not exists(select 1 from public.reminder_preferences where user_id=own and browser_enabled and days_before=3) then raise exception 'Own preference not persisted'; end if;
  delete from public.category_budgets where user_id=own and month='2099-11-01';
end $$;
rollback;
