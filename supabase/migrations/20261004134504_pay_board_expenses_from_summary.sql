create or replace function public.pay_board_expenses_from_summary()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare month_start date;
begin
  if new.board_id is not null or new.represents_board_id is null
     or new.status <> 'Pago' or old.status is not distinct from new.status then
    return new;
  end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.boards b where b.id = new.represents_board_id and b.user_id = auth.uid()) then
    raise exception 'Quadro relacionado não encontrado.' using errcode = '42501';
  end if;
  month_start := date_trunc('month', new.data_pagamento)::date;
  update public.expenses
    set status = 'Pago'
    where board_id = new.represents_board_id
      and user_id = auth.uid()
      and represents_board_id is null
      and data_pagamento >= month_start
      and data_pagamento < (month_start + interval '1 month')::date
      and status is distinct from 'Pago';
  return new;
end;
$$;
revoke all on function public.pay_board_expenses_from_summary() from public, anon, authenticated;
create trigger trg_pay_board_expenses_from_summary
after update of status on public.expenses
for each row
when (new.board_id is null and new.represents_board_id is not null and new.status = 'Pago' and old.status is distinct from new.status)
execute function public.pay_board_expenses_from_summary();
