begin;

create function public.move_installment_group(
  expense_id_input uuid, group_id_input uuid, destination_name_input text,
  name_input text, payment_date_input date, amount_input numeric,
  status_input text, comment_input text, category_input text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  account_id uuid := auth.uid();
  source_group uuid;
  target_name text := nullif(btrim(destination_name_input),'');
  target_board uuid;
  target_date date;
  item record;
  changed integer := 0;
begin
  if account_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if group_id_input is null or payment_date_input is null or extract(year from payment_date_input) not between 1 and 9999
    or nullif(btrim(name_input),'') is null or amount_input is null or amount_input<=0
    or amount_input::text in ('NaN','Infinity','-Infinity') or status_input is null
    or status_input not in ('Pago','Pendente','VR/VA') or category_input is null
    or (category_input<>'Sem categoria' and not exists(select 1 from public.expense_categories c where c.user_id=account_id and c.name=category_input))
  then raise exception 'Invalid expense data' using errcode='22023'; end if;

  -- Serialize group moves from this account, including destination creation.
  perform pg_advisory_xact_lock(hashtextextended('move-installments:'||account_id::text,0));
  select e.installment_group_id into source_group from public.expenses e
    where e.id=expense_id_input and e.user_id=account_id and e.represents_board_id is null for update;
  if not found or source_group is null or source_group<>group_id_input
    then raise exception 'Expense group unavailable' using errcode='42501'; end if;

  for item in select e.id,e.data_pagamento from public.expenses e
    where e.user_id=account_id and e.installment_group_id=source_group and e.represents_board_id is null
    order by e.id for update
  loop
    target_date := case when item.id=expense_id_input then payment_date_input else item.data_pagamento end;
    target_board := null;
    if target_name is not null then
      select b.id into target_board from public.boards b
        where b.user_id=account_id and b.month=extract(month from target_date)::integer-1
          and b.year=extract(year from target_date)::integer and lower(btrim(b.name))=lower(target_name)
        order by b.created_at,b.id limit 1 for update;
      if not found then
        insert into public.boards(user_id,name,month,year)
          values(account_id,target_name,extract(month from target_date)::integer-1,extract(year from target_date)::integer)
          returning id into target_board;
      end if;
    end if;
    if item.id=expense_id_input then
      update public.expenses set board_id=target_board,nome=btrim(name_input),data_pagamento=payment_date_input,
        valor=amount_input,status=status_input,comentario=nullif(btrim(comment_input),''),category=category_input
        where id=item.id and user_id=account_id and installment_group_id=source_group and represents_board_id is null;
    else
      update public.expenses set board_id=target_board
        where id=item.id and user_id=account_id and installment_group_id=source_group and represents_board_id is null;
    end if;
    if not found then raise exception 'Expense changed during move' using errcode='40001'; end if;
    changed := changed+1;
  end loop;
  return jsonb_build_object('expense_id',expense_id_input,'updated',changed);
end;
$$;

revoke all on function public.move_installment_group(uuid,uuid,text,text,date,numeric,text,text,text) from public,anon;
grant execute on function public.move_installment_group(uuid,uuid,text,text,date,numeric,text,text,text) to authenticated;

commit;
