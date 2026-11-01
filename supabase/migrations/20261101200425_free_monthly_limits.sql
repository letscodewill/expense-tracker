begin;
-- New limits preserve existing boards and use successful analyses in each calendar month.
create or replace function app_private.enforce_free_boards() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not (select enabled from app_private.billing_settings where id) then return new; end if;
  if tg_op='UPDATE' and (new.user_id,new.month,new.year) is not distinct from (old.user_id,old.month,old.year) then return new; end if;
  if new.user_id is distinct from auth.uid() then raise exception 'Quadro indisponível.' using errcode='42501'; end if;
  if app_private.get_my_plan()->>'plan'='pro' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('board-limit:'||new.user_id::text,0));
  if (select count(*) from public.boards where user_id=new.user_id and month=new.month and year=new.year and id<>new.id)>=1 then
    raise exception 'O plano Free permite 1 quadro secundário por mês. Conheça o Pro.' using errcode='23514';
  end if;
  return new;
end $$;

create or replace function app_private.reserve_invoice_ai() returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); month_start date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  occupied integer; completed integer; reservation uuid; quota integer:=4; lifetime boolean:=false;
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
