-- Tabelas para integração Capy-Pay no Supabase

-- Extensões necessárias
create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id text primary key,
  external_id text,
  user_id text not null,
  user_address text,
  type text not null,
  amount integer not null,
  description text,
  status text not null,
  qr_code text,
  pix_key text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  completed_at timestamptz,
  actual_amount integer,
  metadata jsonb,
  updated_at timestamptz
);

create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_status_idx on public.transactions(status);

create table if not exists public.capy_mints (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null references public.transactions(id) on delete cascade,
  user_address text not null,
  capy_amount numeric(30, 18) not null,
  tx_hash text,
  minted_at timestamptz default now(),
  error text
);

create index if not exists capy_mints_tx_idx on public.capy_mints(transaction_id);
create index if not exists capy_mints_user_idx on public.capy_mints(user_address);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  subscription text,
  payload jsonb,
  received_at timestamptz default now()
);

-- Observação: políticas RLS podem ser adicionadas conforme necessário.

-- ==========================================
-- Tabelas adicionais: autenticação, cadastro,
-- depósitos, pontos, indicações, investimentos,
-- pagamento de boletos
-- ==========================================

-- Usuários (perfil básico com dados do Google)
create table if not exists public.users (
  id text primary key,
  email text unique not null,
  name text,
  picture text,
  google_id text,
  email_verified boolean default false,
  wallet_address text,
  providers text,
  referral_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists users_email_idx on public.users(email);

-- Garantir coluna providers para ambientes já existentes
alter table if exists public.users add column if not exists providers text;

-- Sessões de autenticação
create table if not exists public.sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  created_at timestamptz default now(),
  expires_at timestamptz,
  last_seen_at timestamptz
);
create index if not exists sessions_user_id_idx on public.sessions(user_id);

-- Depósitos (PIX, boleto, transferência)
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  transaction_id text references public.transactions(id) on delete set null,
  user_id text not null references public.users(id) on delete cascade,
  method text not null, -- 'pix', 'boleto', 'transfer'
  amount integer not null,
  currency text default 'BRL',
  status text not null, -- 'pending','confirmed','failed','refunded'
  credited_at timestamptz,
  description text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create index if not exists deposits_user_id_idx on public.deposits(user_id);
create index if not exists deposits_status_idx on public.deposits(status);
create index if not exists deposits_tx_idx on public.deposits(transaction_id);

-- Pontos (ledger e visão de saldo)
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  points integer not null,
  reason text,
  source_transaction_id text references public.transactions(id) on delete set null,
  created_at timestamptz default now(),
  metadata jsonb
);
create index if not exists points_user_idx on public.points_ledger(user_id);

create or replace view public.points_balances as
  select user_id, coalesce(sum(points), 0) as balance
  from public.points_ledger
  group by user_id;

-- Indicações (referrals)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id text not null references public.users(id) on delete cascade,
  referred_user_id text references public.users(id) on delete set null,
  referral_code text,
  status text default 'pending', -- 'pending','completed','cancelled'
  created_at timestamptz default now(),
  completed_at timestamptz,
  metadata jsonb
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_user_id);
create index if not exists referrals_referred_idx on public.referrals(referred_user_id);
create index if not exists referrals_status_idx on public.referrals(status);

-- Investimentos (produtos, operações e posições)
create table if not exists public.investment_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text, -- 'staking','fund','cdb', etc
  risk_level text,
  apy numeric(10,4),
  min_amount integer,
  is_active boolean default true,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  product_id uuid not null references public.investment_products(id) on delete restrict,
  amount integer not null,
  status text not null, -- 'pending','active','withdrawn','failed'
  created_at timestamptz default now(),
  activated_at timestamptz,
  closed_at timestamptz,
  metadata jsonb
);
create index if not exists investments_user_idx on public.investments(user_id);
create index if not exists investments_product_idx on public.investments(product_id);
create index if not exists investments_status_idx on public.investments(status);

create table if not exists public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  principal integer not null,
  accrued_returns numeric(30,18) default 0,
  last_update_at timestamptz default now()
);
create index if not exists investment_positions_user_idx on public.investment_positions(user_id);

-- Pagamento de boletos
create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  boleto_type text, -- 'title','concessionaria','other'
  boleto_number text not null,
  amount integer not null,
  status text not null, -- 'created','paid','failed','refunded'
  provider text,
  external_id text,
  payment_date timestamptz,
  tx_hash text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create index if not exists bill_payments_user_idx on public.bill_payments(user_id);
create index if not exists bill_payments_status_idx on public.bill_payments(status);

-- Registro de conexões de carteiras não-custodiais
create table if not exists public.wallet_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.users(id) on delete set null,
  wallet_address text unique not null,
  wallet_type text not null, -- 'metamask','walletconnect','coinbase'
  connected_at timestamptz default now(),
  metadata jsonb
);
create index if not exists wallet_connections_user_idx on public.wallet_connections(user_id);