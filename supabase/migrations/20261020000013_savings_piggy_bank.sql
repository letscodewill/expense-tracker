-- One account-wide piggy bank, separate from expenses and salary.
create table app_private.savings_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents between 0 and 99999999999),
  goal_cents bigint check (goal_cents between 1 and 99999999999),
  updated_at timestamptz not null default now()
);
create table app_private.savings_operations (
  user_id uuid not null references app_private.savings_accounts(user_id) on delete cascade,
  request_id uuid not null,
  action text not null check (action in ('goal','deposit','withdraw')),
  amount_cents bigint not null check (amount_cents between 1 and 99999999999),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table app_private.savings_accounts enable row level security;
alter table app_private.savings_operations enable row level security;
revoke all on app_private.savings_accounts, app_private.savings_operations from public, anon, authenticated;

-- Privileged code stays outside the exposed schema. Identity is derived only
-- from Auth, never supplied by a caller. The account row serializes mutations.
create function app_private.savings_account_action(action_input text, amount_input bigint, request_input uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  account_row app_private.savings_accounts%rowtype;
  previous_operation app_private.savings_operations%rowtype;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  if action_input is null or action_input not in ('read','goal','deposit','withdraw') then
    raise exception 'Operação inválida.' using errcode = '22023';
  end if;
  if action_input = 'read' then
    select * into account_row from app_private.savings_accounts where user_id = account_id;
  else
    if amount_input is null or amount_input < 1 or amount_input > 99999999999 or request_input is null then
      raise exception 'Informe um valor positivo com até duas casas decimais.' using errcode = '22023';
    end if;
    insert into app_private.savings_accounts(user_id) values (account_id) on conflict do nothing;
    select * into account_row from app_private.savings_accounts where user_id = account_id for update;
    select * into previous_operation from app_private.savings_operations where user_id = account_id and request_id = request_input;
    if found then
      if previous_operation.action <> action_input or previous_operation.amount_cents <> amount_input then
        raise exception 'Operação repetida com dados diferentes.' using errcode = '22023';
      end if;
    else
      if action_input = 'goal' then account_row.goal_cents := amount_input;
      elsif action_input = 'deposit' then
        if account_row.balance_cents > 99999999999 - amount_input then
          raise exception 'O saldo ultrapassaria o limite permitido.' using errcode = '23514';
        end if;
        account_row.balance_cents := account_row.balance_cents + amount_input;
      else
        if amount_input > account_row.balance_cents then
          raise exception 'O valor da retirada é maior que o saldo do cofrinho.' using errcode = '23514';
        end if;
        account_row.balance_cents := account_row.balance_cents - amount_input;
      end if;
      update app_private.savings_accounts set balance_cents = account_row.balance_cents,
        goal_cents = account_row.goal_cents, updated_at = now() where user_id = account_id;
      insert into app_private.savings_operations(user_id,request_id,action,amount_cents)
        values (account_id,request_input,action_input,amount_input);
    end if;
  end if;
  return jsonb_build_object('balance_cents',coalesce(account_row.balance_cents,0),'goal_cents',account_row.goal_cents);
end;
$$;
revoke all on function app_private.savings_account_action(text,bigint,uuid) from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.savings_account_action(text,bigint,uuid) to authenticated;

create function public.savings_account_action(action_input text default 'read', amount_input bigint default null, request_input uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select app_private.savings_account_action(action_input,amount_input,request_input);
$$;
revoke all on function public.savings_account_action(text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.savings_account_action(text,bigint,uuid) to authenticated;
