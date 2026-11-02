begin;
-- Raise Pro to ten analyses; preserve current usage, Free quota and safety guards.
create or replace function app_private.reserve_invoice_ai() returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); month_start date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  occupied integer; completed integer; reservation uuid; quota integer:=10; lifetime boolean:=false;
begin
  if account_id is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  if public.is_support_owner() then quota:=null;
  elsif (select enabled from app_private.billing_settings where id) and app_private.get_my_plan()->>'plan'<>'pro' then quota:=1;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai-quota:'||account_id::text,0));
  select count(*) filter(where state='succeeded'),count(*) filter(where state='succeeded' or (state='pending' and expires_at>now())) into completed,occupied
    from app_private.invoice_ai_reservations where user_id=account_id and period=month_start;
  if quota is not null and occupied>=quota then return jsonb_build_object('allowed',false,'used',completed,'limit',quota,'period',month_start,'lifetime',lifetime); end if;
  if (select count(*) from app_private.invoice_ai_reservations where user_id=account_id and created_at>now()-interval '1 hour')>=20 then
    return jsonb_build_object('allowed',false,'reason','rate','used',completed,'limit',quota,'period',month_start,'lifetime',lifetime);
  end if;
  insert into app_private.invoice_ai_reservations(user_id,period) values(account_id,month_start) returning token into reservation;
  return jsonb_build_object('allowed',true,'token',reservation,'used',completed,'limit',quota,'period',month_start,'lifetime',lifetime);
end $$;

notify pgrst,'reload schema';
commit;
