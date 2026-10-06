create table public.expense_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 1 and 60 and name=trim(name) and name !~ '\s{2,}'),
  primary key(user_id,name)
);
create unique index expense_categories_unique_name on public.expense_categories(user_id,lower(name));
alter table public.expense_categories enable row level security;
revoke all on public.expense_categories from anon,authenticated;
grant select,insert,delete on public.expense_categories to authenticated;
create policy categories_read on public.expense_categories for select to authenticated using((select auth.uid())=user_id);
create policy categories_add on public.expense_categories for insert to authenticated with check((select auth.uid())=user_id);
create policy categories_remove on public.expense_categories for delete to authenticated using((select auth.uid())=user_id and name<>'Sem categoria');
insert into public.expense_categories(user_id,name)
select u.id,c.name from auth.users u cross join unnest(array['Sem categoria','Mercado','Transporte','Lazer','Moradia','Saúde','Educação','Alimentação','Assinaturas','Outros']) c(name);
alter table public.expenses drop constraint expenses_category_check;
alter table public.category_budgets drop constraint category_budgets_category_check;
alter table public.expenses add constraint expenses_category_owner_fk foreign key(user_id,category) references public.expense_categories(user_id,name) deferrable initially deferred;
alter table public.category_budgets add constraint budgets_category_owner_fk foreign key(user_id,category) references public.expense_categories(user_id,name) on delete cascade;
create or replace function public.reassign_removed_category() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if old.name <> 'Sem categoria' then
    update public.expenses set category='Sem categoria' where user_id=old.user_id and category=old.name;
  end if;
  return old;
end;
$$;
revoke all on function public.reassign_removed_category() from public,anon,authenticated;
create trigger reassign_removed_category before delete on public.expense_categories for each row execute function public.reassign_removed_category();
create schema if not exists app_private;
create function app_private.seed_expense_categories() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.expense_categories(user_id,name) select new.id,name from unnest(array['Sem categoria','Mercado','Transporte','Lazer','Moradia','Saúde','Educação','Alimentação','Assinaturas','Outros']) name;
  return new;
end;
$$;
revoke all on function app_private.seed_expense_categories() from public,anon,authenticated;
create trigger seed_expense_categories after insert on auth.users for each row execute function app_private.seed_expense_categories();
