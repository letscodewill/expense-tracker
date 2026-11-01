begin;
create function app_private.get_my_billing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.' using errcode='42501'; end if;
  return jsonb_build_object('has_customer',exists(select 1 from app_private.billing_customers where user_id=auth.uid()),
    'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('status',status,'period_end',period_end,'cancel_at_period_end',cancel_at_period_end))
      from app_private.billing_subscriptions where user_id=auth.uid() and status not in ('canceled','incomplete_expired')),'[]'::jsonb),
    'limits_enabled',(select enabled from app_private.billing_settings where id));
end $$;
create or replace function public.get_my_billing() returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.get_my_billing(); $$;
revoke all on function app_private.get_my_billing(),public.get_my_billing() from public,anon;
grant execute on function app_private.get_my_billing(),public.get_my_billing() to authenticated;
commit;
