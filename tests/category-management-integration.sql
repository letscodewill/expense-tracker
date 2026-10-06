begin;
create temporary table category_test_context(owner_id uuid,other_id uuid,expense_id uuid);
insert into category_test_context(owner_id,other_id) select (select id from auth.users order by id limit 1),(select id from auth.users order by id offset 1 limit 1);
grant select,update on category_test_context to authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from category_test_context;
set local role authenticated;
do $$ declare own uuid; other uuid; expense_key uuid; begin
  select owner_id,other_id into own,other from category_test_context;
  insert into public.expense_categories(user_id,name) values(own,'__category_test_pets__');
  insert into public.expenses(user_id,nome,valor,data_pagamento,status,category) values(own,'__category_test_expense__',42,'2099-11-05','VR/VA','__category_test_pets__') returning id into expense_key;
  insert into public.category_budgets(user_id,month,category,amount) values(own,'2099-11-01','__category_test_pets__',100),(own,'2099-12-01','__category_test_pets__',200);
  if exists(select 1 from public.expense_categories where user_id=other) then raise exception 'Foreign categories visible'; end if;
  delete from public.expense_categories where user_id=other;
  if found then raise exception 'Foreign categories deleted'; end if;
  begin
    insert into public.expense_categories(user_id,name) values(other,'__category_test_foreign__');
    raise exception 'Foreign category created';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.expense_categories(user_id,name) values(own,'__CATEGORY_TEST_PETS__');
    raise exception 'Case duplicate accepted';
  exception when unique_violation then null; end;
  delete from public.expense_categories where user_id=own and name='Sem categoria';
  if found then raise exception 'Fallback category removed'; end if;
  delete from public.expense_categories where user_id=own and name='__category_test_pets__';
  if not exists(select 1 from public.expenses where id=expense_key and category='Sem categoria' and valor=42 and status='VR/VA' and data_pagamento='2099-11-05') then raise exception 'Expense lost or changed after category removal'; end if;
  if exists(select 1 from public.category_budgets where user_id=own and category='__category_test_pets__') then raise exception 'Category budgets not removed'; end if;
end $$;
set constraints all immediate;
rollback;
