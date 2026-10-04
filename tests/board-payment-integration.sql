begin;
create temporary table payment_test_context(owner_id uuid, other_id uuid, target uuid, other_board uuid, foreign_board uuid);
insert into payment_test_context
select (select id from auth.users order by id limit 1),
       (select id from auth.users order by id offset 1 limit 1),
       gen_random_uuid(),gen_random_uuid(),gen_random_uuid();
grant select on payment_test_context to authenticated;
insert into public.boards(id,user_id,name,month,year)
select target,owner_id,'__payment_test_target__',9,2099 from payment_test_context
union all select other_board,owner_id,'__payment_test_other__',9,2099 from payment_test_context
union all select foreign_board,other_id,'__payment_test_foreign__',9,2099 from payment_test_context;
insert into public.expenses(user_id,board_id,nome,data_pagamento,valor,status)
select owner_id,target,'__payment_test_pending__',date '2099-10-01',10,'Pendente' from payment_test_context
union all select owner_id,target,'__payment_test_vr__',date '2099-10-31',20,'VR/VA' from payment_test_context
union all select owner_id,target,'__payment_test_paid__',date '2099-10-15',30,'Pago' from payment_test_context
union all select owner_id,target,'__payment_test_future__',date '2099-11-01',40,'Pendente' from payment_test_context
union all select owner_id,target,'__payment_test_past__',date '2099-09-30',50,'Pendente' from payment_test_context
union all select owner_id,other_board,'__payment_test_other__',date '2099-10-10',60,'Pendente' from payment_test_context
union all select other_id,foreign_board,'__payment_test_foreign__',date '2099-10-10',70,'Pendente' from payment_test_context
union all select other_id,target,'__payment_test_wrong_owner__',date '2099-10-10',80,'Pendente' from payment_test_context;
select set_config('request.jwt.claim.sub',owner_id::text,true) from payment_test_context;
set local role authenticated;
do $$
declare b uuid; n integer;
begin
  select target into b from payment_test_context;
  update public.expenses set status='Pago' where represents_board_id=b and board_id is null;
  if (select count(*) from public.expenses where board_id=b and data_pagamento >= date '2099-10-01' and data_pagamento < date '2099-11-01' and status='Pago') <> 3 then raise exception 'FAIL: linked month not paid'; end if;
  if exists(select 1 from public.expenses where nome in ('__payment_test_future__','__payment_test_past__','__payment_test_other__') and status <> 'Pendente') then raise exception 'FAIL: unrelated expenses changed'; end if;
  update public.expenses set status='Pendente' where represents_board_id=b;
  if (select count(*) from public.expenses where board_id=b and status='Pago') <> 3 then raise exception 'FAIL: undo changed individual payments'; end if;
  update public.expenses set status='Pago' where represents_board_id=b;
  update public.expenses set valor=valor where represents_board_id=b;
  update public.expenses set status='Pago' where represents_board_id=(select foreign_board from payment_test_context);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: another owner accessible'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.expenses where nome='__payment_test_wrong_owner__' and status <> 'Pendente') then raise exception 'FAIL: other user changed'; end if;
  if exists(select 1 from public.expenses where nome='__payment_test_foreign__' and status <> 'Pendente') then raise exception 'FAIL: foreign board changed'; end if;
end $$;
-- Force one child update to fail, then verify the summary rolls back too.
create function pg_temp.reject_payment_test() returns trigger language plpgsql as $$
begin if new.nome='__payment_test_other__' and new.status='Pago' then raise exception 'simulated child failure'; end if; return new; end $$;
create trigger payment_test_failure before update of status on public.expenses for each row execute function pg_temp.reject_payment_test();
set local role authenticated;
do $$
declare caught boolean := false;
begin
  begin
    update public.expenses set status='Pago' where represents_board_id=(select other_board from payment_test_context);
  exception when raise_exception then caught := true;
  end;
  if not caught then raise exception 'FAIL: child failure not propagated'; end if;
  if exists(select 1 from public.expenses where represents_board_id=(select other_board from payment_test_context) and status <> 'Pendente') then raise exception 'FAIL: summary partially committed'; end if;
end $$;
reset role;
rollback;
select 'PASS: linked payments, month boundaries, unrelated boards, user isolation, undo, repeated updates and atomic rollback' as result;

