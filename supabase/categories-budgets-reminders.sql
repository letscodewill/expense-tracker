alter table public.expenses add column category text not null default 'Sem categoria'
  check (category in ('Sem categoria','Mercado','Transporte','Lazer','Moradia','Saúde','Educação','Alimentação','Assinaturas','Outros'));
create table public.category_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month)=1),
  category text not null check (category in ('Sem categoria','Mercado','Transporte','Lazer','Moradia','Saúde','Educação','Alimentação','Assinaturas','Outros')),
  amount numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  primary key(user_id,month,category)
);
create table public.reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  browser_enabled boolean not null default false,
  days_before integer not null default 3 check (days_before between 0 and 14)
);
alter table public.category_budgets enable row level security;
alter table public.reminder_preferences enable row level security;
revoke all on public.category_budgets,public.reminder_preferences from anon,authenticated;
grant select,insert,update,delete on public.category_budgets,public.reminder_preferences to authenticated;
create policy budgets_owner on public.category_budgets for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy reminders_owner on public.reminder_preferences for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
