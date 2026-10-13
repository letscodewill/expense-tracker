begin;

create or replace function public.sync_board_summary_expense()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare target_board uuid; owner_id uuid;
begin
  -- A parent payment already updates all children in the same transaction.
  -- Do not write back into that parent while its UPDATE is still running.
  if pg_trigger_depth()>1 then return coalesce(new,old); end if;
  for target_board in
    select distinct id from unnest(array[new.board_id,old.board_id]) id where id is not null order by id
  loop
    select b.user_id into owner_id from public.boards b where b.id=target_board for update;
    if not found then continue; end if;
    with totals as (
      select m.id,coalesce(sum(e.valor),0) as total,
        case when count(e.id)>0 and bool_and(coalesce(e.status in ('Pago','VR/VA'),false)) then 'Pago' else 'Pendente' end as status
      from public.expenses m left join public.expenses e
        on e.board_id=target_board and e.user_id=owner_id and e.represents_board_id is null
        and e.data_pagamento>=date_trunc('month',m.data_pagamento)::date
        and e.data_pagamento<(date_trunc('month',m.data_pagamento)+interval '1 month')::date
      where m.represents_board_id=target_board and m.user_id=owner_id and m.board_id is null
      group by m.id
    )
    update public.expenses m set valor=t.total,status=t.status from totals t
      where m.id=t.id and (m.valor,m.status) is distinct from (t.total,t.status);
  end loop;
  return coalesce(new,old);
end;
$$;
revoke all on function public.sync_board_summary_expense() from public,anon,authenticated;

create or replace function public.pay_board_expenses_from_summary()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare month_start date;
begin
  -- Automatically settled summaries must not convert VR/VA or mutate children.
  if pg_trigger_depth()>1 or new.board_id is not null or new.represents_board_id is null
    or new.status<>'Pago' or old.status is not distinct from new.status then return new; end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if not exists(select 1 from public.boards b where b.id=new.represents_board_id and b.user_id=auth.uid()) then
    raise exception 'Quadro relacionado não encontrado.' using errcode='42501';
  end if;
  month_start:=date_trunc('month',new.data_pagamento)::date;
  update public.expenses set status='Pago'
    where board_id=new.represents_board_id and user_id=auth.uid() and represents_board_id is null
      and data_pagamento>=month_start and data_pagamento<(month_start+interval '1 month')::date
      and status is distinct from 'Pago';
  return new;
end;
$$;
revoke all on function public.pay_board_expenses_from_summary() from public,anon,authenticated;

commit;
