-- Synthetic data only; every write, including test triggers, is rolled back.
begin;
create temporary table move_test_context as
select (select id from auth.users order by id limit 1) owner_id,
  (select id from auth.users order by id offset 1 limit 1) other_id,
  gen_random_uuid() group_id, gen_random_uuid() other_group;
grant select on move_test_context to authenticated;
do $$ begin
  if exists(select 1 from move_test_context where owner_id is null or other_id is null) then
    raise exception 'Two accounts required';
  end if;
end $$;
insert into public.boards(user_id,name,month,year)
select owner_id,'__move_source__',11,2098 from move_test_context
union all select owner_id,'__move_source__',0,2099 from move_test_context
union all select owner_id,'__move_source__',1,2099 from move_test_context
union all select owner_id,'__move_target__',0,2099 from move_test_context;
insert into public.expenses(user_id,board_id,nome,data_pagamento,valor,status,installment_group_id,installment_number,installment_total,valor_total)
select c.owner_id,b.id,'__move_part__',make_date(b.year,b.month+1,6),10,
  case when b.month=11 then 'Pago' when b.month=0 then 'VR/VA' else 'Pendente' end,
  c.group_id,case when b.month=11 then 1 else b.month+2 end,3,30
from move_test_context c join public.boards b on b.user_id=c.owner_id and b.name='__move_source__';
insert into public.expenses(user_id,nome,data_pagamento,valor,installment_group_id)
select owner_id,'__move_unrelated__',date '2099-01-06',7,other_group from move_test_context
union all select other_id,'__move_foreign__',date '2099-01-06',8,group_id from move_test_context;
create temporary table move_before as select e.* from public.expenses e join move_test_context c
  on e.installment_group_id in(c.group_id,c.other_group) where e.represents_board_id is null;
grant select on move_before to authenticated;
-- Fail on the second group row, after an earlier row and its board were processed.
create function pg_temp.fail_move_test() returns trigger language plpgsql as $$ begin
  if new.id=(select id from move_before where nome='__move_part__' order by id offset 1 limit 1)
     and exists(select 1 from public.boards where id=new.board_id and name='__move_fail__') then
    raise exception 'simulated move failure' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger test_move_failure before update on public.expenses for each row execute function pg_temp.fail_move_test();
select set_config('request.jwt.claim.sub',owner_id::text,true) from move_test_context;
set local role authenticated;
do $$
declare c record; e record; result jsonb; before_boards integer;
begin
  select * into c from move_test_context;
  select * into e from move_before where nome='__move_part__' and installment_number=2;
  select count(*) into before_boards from public.boards;
  begin
    perform public.move_installment_group(e.id,c.group_id,'__move_fail__',e.nome,e.data_pagamento,e.valor,e.status,e.comentario,e.category);
    raise exception 'FAIL: injected failure did not fire' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  if (select count(*) from public.boards)<>before_boards or exists(
    select 1 from public.expenses x join move_before b using(id) where x.board_id is distinct from b.board_id
  ) then raise exception 'FAIL: partial writes survived'; end if;
  result := public.move_installment_group(e.id,c.group_id,'__move_target__',e.nome,e.data_pagamento,e.valor,e.status,e.comentario,e.category);
  if (result->>'updated')::integer<>3 then raise exception 'FAIL: group count'; end if;
  if (select count(*) from public.boards where name='__move_target__')<>3 then raise exception 'FAIL: create/reuse monthly boards'; end if;
  if exists(select 1 from public.expenses x join move_before b using(id)
    left join public.boards d on d.id=x.board_id where b.nome='__move_part__'
    and (d.id is null or d.name<>'__move_target__' or d.month<>extract(month from x.data_pagamento)::integer-1 or d.year<>extract(year from x.data_pagamento)))
    then raise exception 'FAIL: installment routed to wrong period'; end if;
  if exists(select 1 from public.expenses x join move_before b using(id) where b.nome='__move_part__' and
    (to_jsonb(x)-'board_id') is distinct from (to_jsonb(b)-'board_id')) then raise exception 'FAIL: installment data changed'; end if;
  if exists(select 1 from public.expenses x join move_before b using(id) where b.nome='__move_unrelated__' and to_jsonb(x)<>to_jsonb(b))
    then raise exception 'FAIL: unrelated group changed'; end if;
  perform public.move_installment_group(e.id,c.group_id,'__move_target__',e.nome,e.data_pagamento,e.valor,e.status,e.comentario,e.category);
  if (select count(*) from public.boards where name='__move_target__')<>3 then raise exception 'FAIL: retry duplicated boards'; end if;
  begin
    perform public.move_installment_group(e.id,c.other_group,'__move_invalid__',e.nome,e.data_pagamento,e.valor,e.status,e.comentario,e.category);
    raise exception 'FAIL: mismatched group accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    perform public.move_installment_group((select id from move_before where nome='__move_foreign__'),c.group_id,'__move_invalid__',e.nome,e.data_pagamento,e.valor,e.status,e.comentario,e.category);
    raise exception 'FAIL: foreign owner accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  perform public.move_installment_group(e.id,c.group_id,null,e.nome,e.data_pagamento,e.valor,e.status,e.comentario,e.category);
  if exists(select 1 from public.expenses where user_id=c.owner_id and installment_group_id=c.group_id and board_id is not null)
    then raise exception 'FAIL: principal move incomplete'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.expenses x join move_before b using(id) where b.nome='__move_foreign__' and to_jsonb(x)<>to_jsonb(b))
    then raise exception 'FAIL: foreign installment changed'; end if;
  if has_function_privilege('anon','public.move_installment_group(uuid,uuid,text,text,date,numeric,text,text,text)','execute')
    then raise exception 'FAIL: anonymous execute allowed'; end if;
end $$;
rollback;
select 'PASS: all installments, paid/VRVA preservation, month/year routing, create/reuse, retry, main board, owner/group isolation, anonymous denial and atomic rollback' result;
