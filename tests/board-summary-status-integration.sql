begin;
create temporary table summary_status_context(owner_id uuid,target uuid,other_board uuid);
insert into summary_status_context select (select id from auth.users order by id limit 1),gen_random_uuid(),gen_random_uuid();
grant select on summary_status_context to authenticated;
insert into public.boards(id,user_id,name,month,year)
select target,owner_id,'__summary_status_target__',9,2099 from summary_status_context
union all select other_board,owner_id,'__summary_status_other__',9,2099 from summary_status_context;
select set_config('request.jwt.claim.sub',owner_id::text,true) from summary_status_context;
set local role authenticated;
insert into public.expenses(user_id,board_id,nome,data_pagamento,valor,status)
select owner_id,target,'__summary_status_one__',date '2099-10-01',10,'Pendente' from summary_status_context
union all select owner_id,target,'__summary_status_two__',date '2099-10-15',20,'Pendente' from summary_status_context
union all select owner_id,target,'__summary_status_future__',date '2099-11-01',40,'Pendente' from summary_status_context
union all select owner_id,other_board,'__summary_status_other__',date '2099-10-10',60,'Pendente' from summary_status_context;
do $$
declare b uuid; ob uuid;
begin
  select target,other_board into b,ob from summary_status_context;
  update public.expenses set status='Pago' where nome='__summary_status_one__';
  if (select status from public.expenses where represents_board_id=b)<>'Pendente' then raise exception 'FAIL: partial payment settled summary'; end if;
  update public.expenses set status='Pago' where nome='__summary_status_two__';
  if (select status from public.expenses where represents_board_id=b)<>'Pago' then raise exception 'FAIL: last payment did not settle summary'; end if;
  if (select valor from public.expenses where represents_board_id=b)<>30 then raise exception 'FAIL: another month included in total'; end if;
  if (select status from public.expenses where nome='__summary_status_future__')<>'Pendente' then raise exception 'FAIL: future payment changed'; end if;
  update public.expenses set status='VR/VA' where nome='__summary_status_one__';
  if (select status from public.expenses where represents_board_id=b)<>'Pago' then raise exception 'FAIL: VR/VA unsettled summary'; end if;
  if (select status from public.expenses where nome='__summary_status_one__')<>'VR/VA' then raise exception 'FAIL: reverse sync converted VR/VA'; end if;
  insert into public.expenses(user_id,board_id,nome,data_pagamento,valor,status)
    select owner_id,target,'__summary_status_new__',date '2099-10-20',7,'Pendente' from summary_status_context;
  if (select status from public.expenses where represents_board_id=b)<>'Pendente' then raise exception 'FAIL: new debt did not reopen summary'; end if;
  if (select valor from public.expenses where represents_board_id=b)<>37 then raise exception 'FAIL: amount not updated'; end if;
  update public.expenses set status='Pago' where nome='__summary_status_new__';
  if (select status from public.expenses where represents_board_id=b)<>'Pago' then raise exception 'FAIL: new debt payment did not settle summary'; end if;
  update public.expenses set status='Pendente' where nome='__summary_status_two__';
  if (select status from public.expenses where represents_board_id=b)<>'Pendente' then raise exception 'FAIL: undo did not reopen summary'; end if;
  update public.expenses set status='Pago' where represents_board_id=b;
  if exists(select 1 from public.expenses where board_id=b and data_pagamento<date '2099-11-01' and status<>'Pago') then raise exception 'FAIL: parent payment no longer pays children'; end if;
  update public.expenses set board_id=ob where nome='__summary_status_new__';
  if (select valor from public.expenses where represents_board_id=b)<>30 then raise exception 'FAIL: old board not refreshed after move'; end if;
  if (select valor from public.expenses where represents_board_id=ob)<>67 then raise exception 'FAIL: destination board not refreshed'; end if;
  if (select status from public.expenses where represents_board_id=ob)<>'Pendente' then raise exception 'FAIL: another pending board incorrectly settled'; end if;
  delete from public.expenses where nome='__summary_status_other__';
  if (select status from public.expenses where represents_board_id=ob)<>'Pago' then raise exception 'FAIL: deleting last pending row did not settle summary'; end if;
  delete from public.expenses where nome='__summary_status_new__';
  if (select status from public.expenses where represents_board_id=ob)<>'Pendente' or (select valor from public.expenses where represents_board_id=ob)<>0 then raise exception 'FAIL: empty board has incorrect summary'; end if;
end $$;
reset role;
rollback;
select 'PASS: partial/full payment, VR/VA preservation, new debt, undo, parent payment, monthly scope, moving rows, deleting pending debt and empty board' as result;
