begin;
create or replace function public.create_board_summary_expense()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.expenses(nome,data_pagamento,valor,status,comentario,user_id,board_id,represents_board_id)
  values(new.name,make_date(new.year,new.month+1,1),0,'Pendente',null,new.user_id,null,new.id);
  return new;
end;
$$;
commit;
