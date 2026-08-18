# 💰 Expense Tracker

Personal expense-tracking web app built with Next.js 16, Supabase and Tailwind CSS.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-blue) ![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3FCF8E) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)

## � Features

- 🔐 **Email/password authentication** (sign-up, sign-in, password reset) via Supabase Auth
- 🧾 **CRUD for expenses** — create, list, edit
- 🏷️ **Status tracking**: `Pendente` · `Pago` · `VR/VA`
- 💵 **Totals** — sum of all expenses shown in the table footer
- 📅 **Date sorting** — expenses ordered by payment date
- � **Dark mode ready** — design tokens in `app/globals.css`

## 🧱 Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19 + Tailwind CSS v4 + Base UI |
| Forms / validation | React `useReducer` + Zod |
| Auth & database | Supabase (`@supabase/ssr`) |
| Icons | `lucide-react` |

## 📁 Project structure

```
app/
  layout.tsx              Root layout
  page.tsx                Auth-gated dashboard
  login/                  Sign-in / sign-up
  auth/update-password/   Password reset form
  actions.ts              signOut server action
components/
  add-expense-dialog.tsx  Create + edit dialog
  expense-table.tsx       Table with totals + edit
  ui/                     shadcn-style primitives (Base UI)
lib/
  supabase/
    client.ts             Browser client
    server.ts             Server client (async cookies)
  utils.ts                cn() helper
middleware.ts             Refreshes Supabase session on every request
```

## 🚀 Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create `.env.local` at the repo root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Database schema

In the Supabase SQL editor, create the `expenses` table:

```sql
create table public.expenses (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  data_pagamento date not null,
  valor numeric not null,
  status text not null check (status in ('Pendente', 'Pago', 'VR/VA')),
  comentario text
);

alter table public.expenses enable row level security;

create policy "Users manage their own expenses"
  on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

> Row Level Security is mandatory — without it any authenticated user can read and edit every row.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## 📜 Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint via `eslint-config-next` |

## ⚠️ Known issues / TODO

- Delete action on expenses
- Filter by status / month
- CSV export
- Confirm `lucide-react@^1.31.0` is the correct version (modern releases are `0.x`)

## 📄 License

Private project.