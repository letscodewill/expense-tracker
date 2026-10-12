begin;
create table app_private.invoice_ai_reservations (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  state text not null default 'pending' check(state in ('pending','succeeded','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '5 minutes'
);
alter table app_private.invoice_ai_reservations enable row level security;
revoke all on app_private.invoice_ai_reservations from public,anon,authenticated;
create index invoice_ai_reservations_usage_idx on app_private.invoice_ai_reservations(user_id,period,state,expires_at);

create function app_private.reserve_invoice_ai()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare account_id uuid:=auth.uid(); month_start date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  occupied integer; completed integer; reservation uuid;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text||month_start::text,0));
  select count(*) filter(where state='succeeded'),count(*) filter(where state='succeeded' or (state='pending' and expires_at>now()))
    into completed,occupied from app_private.invoice_ai_reservations where user_id=account_id and period=month_start;
  if occupied>=4 then return jsonb_build_object('allowed',false,'used',completed,'limit',4,'period',month_start); end if;
  -- Limit direct RPC spam too; no reservation metadata is readable by app accounts.
  if (select count(*) from app_private.invoice_ai_reservations where user_id=account_id and created_at>now()-interval '1 hour')>=20 then
    return jsonb_build_object('allowed',false,'reason','rate','used',completed,'limit',4,'period',month_start);
  end if;
  insert into app_private.invoice_ai_reservations(user_id,period) values(account_id,month_start) returning token into reservation;
  return jsonb_build_object('allowed',true,'token',reservation,'used',completed,'limit',4,'period',month_start);
end;
$$;

-- The token is an unpredictable capability, returned ONLY to the server by its
-- reservation request. Never include it in the API response, logs or client state.
-- Callers cannot enumerate tokens, refund completed analyses or release other users' slots.
create function app_private.finish_invoice_ai(reservation_token uuid,succeeded boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  update app_private.invoice_ai_reservations set state=case when succeeded then 'succeeded' else 'failed' end
    where token=reservation_token and user_id=auth.uid() and state='pending' and expires_at>now();
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;
create function public.reserve_invoice_ai()
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.reserve_invoice_ai(); $$;
create function public.finish_invoice_ai(reservation_token uuid,succeeded boolean)
returns boolean language sql security invoker set search_path=''
as $$ select app_private.finish_invoice_ai(reservation_token,succeeded); $$;
revoke all on function app_private.reserve_invoice_ai(),app_private.finish_invoice_ai(uuid,boolean),public.reserve_invoice_ai(),public.finish_invoice_ai(uuid,boolean) from public,anon,authenticated;
grant execute on function app_private.reserve_invoice_ai(),app_private.finish_invoice_ai(uuid,boolean),public.reserve_invoice_ai(),public.finish_invoice_ai(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
