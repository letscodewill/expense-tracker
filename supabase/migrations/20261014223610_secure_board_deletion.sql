begin;

-- Cascade deletes must never cross account boundaries through forged references.
alter table public.boards add constraint boards_id_user_id_key unique (id,user_id);
alter table public.expenses drop constraint expenses_board_id_fkey;
alter table public.expenses add constraint expenses_board_id_fkey
  foreign key (board_id,user_id) references public.boards(id,user_id) on delete cascade;
alter table public.expenses drop constraint expenses_represents_board_id_fkey;
alter table public.expenses add constraint expenses_represents_board_id_fkey
  foreign key (represents_board_id,user_id) references public.boards(id,user_id) on delete cascade;

create or replace function public.delete_board_cascade(board_id_input uuid)
returns void language plpgsql security invoker set search_path=''
as $$
declare
  account_id uuid := auth.uid();
  board_row public.boards%rowtype;
  candidate_id uuid;
begin
  if account_id is null then
    raise exception 'Entre novamente para excluir o quadro.' using errcode='42501';
  end if;
  select b.* into board_row from public.boards b
    where b.id=board_id_input and b.user_id=account_id for update;
  if not found then
    raise exception 'Quadro não encontrado ou acesso negado.' using errcode='42501';
  end if;

  -- Recurrences survive on the main panel; installments from here are removed.
  update public.expenses set board_id=null
    where board_id=board_id_input and user_id=account_id and recurring_group_id is not null;
  delete from public.expenses e using public.expenses cur
    where cur.board_id=board_id_input and cur.user_id=account_id
      and cur.installment_group_id is not null and e.user_id=account_id
      and e.installment_group_id=cur.installment_group_id
      and e.installment_number>=cur.installment_number;
  delete from public.boards where id=board_id_input and user_id=account_id;

  -- Lock candidates before rechecking emptiness so concurrent inserts are kept.
  for candidate_id in
    select b.id from public.boards b
    where b.user_id=account_id and b.name=board_row.name
      and (b.year,b.month)>(board_row.year,board_row.month)
      and not exists(select 1 from public.expenses e where e.board_id=b.id)
    order by b.year,b.month,b.id for update
  loop
    if not exists(select 1 from public.expenses e where e.board_id=candidate_id) then
      delete from public.boards where id=candidate_id and user_id=account_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.delete_board_cascade(uuid) from public,anon,authenticated,service_role;
grant execute on function public.delete_board_cascade(uuid) to authenticated;

commit;
