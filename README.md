# KoDrift Pharmacy SaaS

A complete pharmacy management & point-of-sale (POS) system for retail pharmacies — inventory, billing, staff, purchases, expenses and business reports in one polished dashboard.

Built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4** and **Supabase** (Postgres). Originally built for Al-Azamat Pharmacy, now maintained as a reusable SaaS starter by [KoDrift](https://kodriftdev.vercel.app).

## Features

### POS Billing (`/dashboard/sales`)
- Barcode / name / formula search with keyboard-first flow
- Pack vs. unit (strip/loose) selling with automatic unit conversion
- Per-item and bill-level discounts (percentage or fixed) — cashiers need the `can_give_discount` permission
- Cash & online payments with change calculation
- 76mm thermal receipt printing
- Server-side price & stock verification on every checkout (prices can't be tampered from the browser)

### Inventory (`/dashboard/inventory`)
- Medicine master with brand, formula, potency, pack size, cost/sale price, category
- Stock levels, batch & expiry-date tracking
- Low-stock and near-expiry alerts
- CSV import / export, full-text search & filters

### Purchases & Restocking (`/dashboard/purchases`)
- Supplier purchase orders, restock cart, automatic stock increments
- Purchase history with line items

### Staff & HR (`/dashboard/staff`, `/dashboard/profile`)
- Role-based access: Super Admin, Admin, Manager, Cashier
- Bcrypt-hashed passwords, signed expiring session cookies
- Attendance (clock in/out), leave requests & approvals, salary/advance payments, CNIC document upload

### Expenses (`/dashboard/expenses`)
- Categorized expense tracking with validation

### Reports (`/dashboard/reports`)
- Revenue, profit, sales trends with charts
- Print / save-as-PDF reports
- Business insights

### Dashboard (`/dashboard`)
- KPIs: today's revenue, profit, low stock, expiring soon
- Revenue chart, recent sales, alerts

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres |
| Auth | Custom staff auth — bcrypt passwords + HMAC-signed httpOnly session cookies |
| Charts | Recharts |
| State | Zustand (UI), Server Components + Server Actions (data) |
| Validation | Zod |

## Getting Started

### 1. Prerequisites
- Node.js 20+
- A Supabase project ([supabase.com](https://supabase.com))

### 2. Install
```bash
npm install
```

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SESSION_SECRET` | Yes | Random 32+ character secret used to sign session cookies. Generate with `openssl rand -hex 32` |

### 4. Database schema
Create these tables in your Supabase project (SQL editor). Enable Row Level Security per the notes in Security.

```sql
-- Medicines / inventory
create table medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  formula text,
  potency text,
  pack_size int not null default 1,
  stock int not null default 0,
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  category text,
  expiry_date date,
  created_at timestamptz default now()
);

-- Staff & auth (passwords are bcrypt hashes — never store plain text)
create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('Super Admin','Admin','Manager','Cashier')),
  phone text,
  cnic text,
  shift text,
  email text unique not null,
  password_hash text not null,
  base_salary numeric default 0,
  commission_rate numeric default 0,
  status text default 'Active',
  can_give_discount boolean default false,
  can_delete_sales boolean default false,
  can_view_reports boolean default false,
  cnic_url text,
  created_at timestamptz default now()
);

create table staff_activity (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id),
  type text not null,
  status text,
  details text,
  created_at timestamptz default now()
);

create table staff_attendance (
  staff_id uuid references staff(id),
  date date not null,
  status text not null,
  primary key (staff_id, date)
);

-- Sales (POS)
create table sales (
  id uuid primary key default gen_random_uuid(),
  total_amount numeric not null,
  net_total numeric not null,
  profit numeric not null default 0,
  created_at timestamptz default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  medicine_id uuid references medicines(id),
  quantity int not null,
  sale_type text,
  price numeric not null,
  profit numeric default 0
);

-- Purchases / restocking
create table purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  total_amount numeric not null,
  status text default 'Completed',
  created_at timestamptz default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchases(id) on delete cascade,
  medicine_id uuid references medicines(id),
  quantity int not null,
  cost_price numeric not null
);

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  amount numeric not null,
  expense_date timestamptz default now(),
  payment_method text,
  vendor_name text,
  created_at timestamptz default now()
);
```

Create a **public** storage bucket named `staff_docs` for CNIC uploads.

Seed your first Super Admin by inserting a staff row with a bcrypt hash, then log in at `/login`.

### 5. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the dashboard (view-only demo mode) or log in at `/login`.

## Deploy on Vercel

1. Import this repo in Vercel.
2. Add the three environment variables from `.env.example` (including `SESSION_SECRET`).
3. Deploy — every push to `main` auto-deploys.

## Security Notes

- **Sessions** are HMAC-SHA256 signed cookies (`SESSION_SECRET`), `httpOnly`, `SameSite=Lax`, `Secure` in production, 12-hour expiry. Role/identity can't be forged by editing cookies.
- **Passwords** are bcrypt-hashed (cost 10). Password hashes are never selected into client-rendered pages.
- **Checkout integrity**: the POS server action re-fetches prices and stock from the database, validates stock availability and discount bounds server-side, and enforces the `can_give_discount` staff permission. Client-submitted totals are ignored.
- **Route guards**: every mutating Server Action goes through `requireSession()` with role checks. The dashboard is intentionally viewable without login (demo mode) but all writes require a staff session.
- **Login hardening**: per-email rate limiting, generic "invalid credentials" responses (no user enumeration), inactive accounts blocked.
- **Input validation**: Zod schemas on all forms and server actions; file uploads restricted by size (5MB) and type (JPG/PNG/PDF).
- **RLS recommendation**: all database access runs server-side. For defense in depth, enable Row Level Security in Supabase with restrictive policies — the app does not depend on direct client DB access.

## Project Structure

```
app/
  dashboard/        # App area (demo-viewable, writes require login)
    sales/          # POS billing
    inventory/      # Medicine master, stock, expiry
    purchases/      # Supplier restocking
    expenses/       # Expense tracking
    staff/          # Team directory & HR
    reports/        # Analytics & PDF reports
    profile/        # Attendance & leave
  login/            # Staff login
lib/
  auth.ts           # Signed sessions, requireSession guard
  supabase/         # Server & browser Supabase clients
components/         # Sidebar, shared UI
store/              # Zustand UI store
types/              # Shared TypeScript types
```

## License

Private — all rights reserved. Built by KoDrift.
