-- Only synthetic rows; always run in one connection and roll back the transaction.
begin;
create temporary table deletion_test_context(
  owner_id uuid,other_id uuid,target uuid,past uuid,future uuid,empty_future uuid,
  unrelated uuid,foreign_board uuid,foreign_empty uuid,installments uuid,recurrence uuid
);
insert into deletion_test_context
select (select id from auth.users order by id limit 1),
  (select id from auth.users order by id offset 1 limit 1),
  gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
  gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid();
grant select on deletion_test_context to authenticated,anon;
do $$ begin
  if exists(select 1 from deletion_test_context where owner_id is null or other_id is null) then
    raise exception 'Test requires two existing accounts.';
  end if;
end $$;
insert into public.boards(id,user_id,name,month,year)
select target,owner_id,'__deletion_security_same__',9,2099 from deletion_test_context
union all select past,owner_id,'__deletion_security_same__',8,2099 from deletion_test_context
union all select future,owner_id,'__deletion_security_same__',10,2099 from deletion_test_context
union all select empty_future,owner_id,'__deletion_security_same__',11,2099 from deletion_test_context
union all select unrelated,owner_id,'__deletion_security_other__',11,2099 from deletion_test_context
union all select foreign_board,other_id,'__deletion_security_same__',9,2099 from deletion_test_context
union all select foreign_empty,other_id,'__deletion_security_same__',11,2099 from deletion_test_context;

insert into public.expenses(user_id,board_id,nome,valor,data_pagamento,status,installment_group_id,installment_number,installment_total)
select owner_id,past,'__deletion_security_past__',10,date '2099-09-05','Pago',installments,1,3 from deletion_test_context
union all select owner_id,target,'__deletion_security_current__',10,date '2099-10-05','Pendente',installments,2,3 from deletion_test_context
union all select owner_id,future,'__deletion_security_future__',10,date '2099-11-05','Pendente',installments,3,3 from deletion_test_context
union all select other_id,foreign_board,'__deletion_security_foreign__',10,date '2099-10-05','Pendente',installments,3,3 from deletion_test_context;
insert into public.expenses(user_id,board_id,nome,valor,data_pagamento,status,recurring_group_id,recurring_number)
select owner_id,target,'__deletion_security_recurring__',20,date '2099-10-05','Pendente',recurrence,1 from deletion_test_context
union all select owner_id,future,'__deletion_security_recurring_future__',20,date '2099-11-05','Pendente',recurrence,2 from deletion_test_context;
insert into public.expenses(user_id,board_id,nome,valor,data_pagamento,status)
select owner_id,target,'__deletion_security_single__',30,date '2099-10-05','Pendente' from deletion_test_context;

-- Permissions reject anonymous callers even if they know a real board UUID.
set local role anon;
do $$ begin
  begin
    perform public.delete_board_cascade((select target from deletion_test_context));
    raise exception 'FAIL: anonymous deletion allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_board_cascade((select target from deletion_test_context));
    raise exception 'FAIL: missing identity accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',owner_id::text,true) from deletion_test_context;
set local role authenticated;
do $$
declare own uuid; foreign_id uuid; target_id uuid;
begin
  select owner_id,foreign_board,target into own,foreign_id,target_id from deletion_test_context;
  begin
    perform public.delete_board_cascade(foreign_id);
    raise exception 'FAIL: another accounts board deleted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_board_cascade(gen_random_uuid());
    raise exception 'FAIL: missing board accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.expenses(user_id,board_id,nome,valor,data_pagamento,status)
    values(own,foreign_id,'__deletion_security_forged__',1,'2099-10-05','Pendente');
    raise exception 'FAIL: cross-account board reference accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.expenses(user_id,represents_board_id,nome,valor,data_pagamento,status)
    values(own,foreign_id,'__deletion_security_forged_summary__',1,'2099-10-05','Pendente');
    raise exception 'FAIL: cross-account summary reference accepted';
  exception when foreign_key_violation then null; end;

  -- The complete operation rolls back if its caller aborts the subtransaction.
  begin
    perform public.delete_board_cascade(target_id);
    raise exception 'synthetic failure' using errcode='P0002';
  exception when no_data_found then null; end;
  if not exists(select 1 from public.boards where id=target_id) then raise exception 'FAIL: rollback lost board'; end if;
  if (select count(*) from public.expenses where board_id=target_id and represents_board_id is null)<>3 then raise exception 'FAIL: rollback lost expenses'; end if;

  perform public.delete_board_cascade(target_id);
end $$;
reset role;

do $$ begin
  if exists(select 1 from public.boards where id=(select target from deletion_test_context)) then raise exception 'FAIL: own board remains'; end if;
  if exists(select 1 from public.expenses where represents_board_id=(select target from deletion_test_context)) then raise exception 'FAIL: summary remains'; end if;
  if exists(select 1 from public.expenses where nome in ('__deletion_security_current__','__deletion_security_future__','__deletion_security_single__')) then raise exception 'FAIL: current/future installments or singles remain'; end if;
  if not exists(select 1 from public.expenses where nome='__deletion_security_recurring__' and board_id is null and valor=20 and status='Pendente') then raise exception 'FAIL: recurrence not preserved on main panel'; end if;
  if not exists(select 1 from public.expenses where nome='__deletion_security_past__' and status='Pago') then raise exception 'FAIL: past installment removed'; end if;
  if not exists(select 1 from public.expenses where nome='__deletion_security_foreign__' and status='Pendente') then raise exception 'FAIL: foreign installment removed'; end if;
  if not exists(select 1 from public.expenses where nome='__deletion_security_recurring_future__') then raise exception 'FAIL: future recurrence removed'; end if;
  if exists(select 1 from public.boards where id=(select empty_future from deletion_test_context)) then raise exception 'FAIL: empty future board not cleaned'; end if;
  if (select count(*) from public.boards where id in (select foreign_board from deletion_test_context union all select foreign_empty from deletion_test_context))<>2 then raise exception 'FAIL: same-name foreign boards deleted'; end if;
  if not exists(select 1 from public.boards where id=(select unrelated from deletion_test_context)) then raise exception 'FAIL: unrelated board deleted'; end if;
  if not exists(select 1 from public.boards where id=(select future from deletion_test_context)) then raise exception 'FAIL: occupied future board deleted'; end if;
end $$;
set constraints all immediate;
rollback;
select 'PASS: anonymous/missing-identity/foreign calls denied; ownership links enforced; normal deletion, recurrences, installments, cleanup and atomic rollback verified' as result;
