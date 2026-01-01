-- =========================
-- Sprint 6: eBay Integration
-- =========================

-- 1) eBay Accounts table
create table if not exists public.ebay_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, -- nullable for single-tenant, or reference to users table
  environment text not null check (environment in ('production', 'sandbox')) default 'sandbox',
  seller_username text,
  scopes text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(environment) -- For v1: one account per environment
);

create index if not exists idx_ebay_accounts_env on public.ebay_accounts(environment);

-- 2) eBay Tokens table (encrypted storage)
-- Note: Encryption should be handled at application level
create table if not exists public.ebay_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ebay_accounts(id) on delete cascade,
  access_token text not null, -- Should be encrypted in production
  refresh_token text not null, -- Should be encrypted in production
  expires_at timestamptz not null,
  token_type text not null default 'Bearer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

create index if not exists idx_ebay_tokens_account on public.ebay_tokens(account_id);
create index if not exists idx_ebay_tokens_expires on public.ebay_tokens(expires_at);

-- 3) eBay Policies table
create table if not exists public.ebay_policies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ebay_accounts(id) on delete cascade,
  fulfillment_policy_id text,
  payment_policy_id text,
  return_policy_id text,
  location_key text, -- merchantLocationKey
  updated_at timestamptz not null default now(),
  unique(account_id)
);

-- 4) eBay Templates table
create table if not exists public.ebay_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ebay_accounts(id) on delete cascade,
  title_template text not null default '{{card.name}} {{set.name}} {{card.number}} {{rarity}} {{condition}}',
  description_template text not null,
  category_id text, -- eBay category ID for Pokémon cards
  listing_duration text not null default 'GTC', -- Good Till Cancelled
  currency text not null default 'GBP',
  updated_at timestamptz not null default now(),
  unique(account_id)
);

-- Default description template
insert into public.ebay_templates (account_id, description_template)
select id, 'Pokémon TCG: {{card.name}}

Set: {{set.name}}
Card No: {{card.number}}
Rarity: {{rarity}}
Condition: {{condition}}
Quantity: {{qty}}

Photos show the exact card(s) you will receive.
Packed securely and dispatched promptly.' as description_template
from public.ebay_accounts
where not exists (
  select 1 from public.ebay_templates where account_id = ebay_accounts.id
)
on conflict do nothing;

-- 5) Generic Jobs table (reusable beyond eBay)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'ebay_publish', 'ebay_sync', etc.
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')) default 'queued',
  payload jsonb not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_status_run_at on public.jobs(status, run_at);
create index if not exists idx_jobs_type_status on public.jobs(type, status);
create index if not exists idx_jobs_payload_lot on public.jobs((payload->>'lotId')) where type = 'ebay_publish';

-- 6) Job Logs table
create table if not exists public.job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_logs_job on public.job_logs(job_id);
create index if not exists idx_job_logs_created on public.job_logs(created_at);

-- 7) Update ebay_listings table (extend existing)
-- Add account_id and other fields if not present
alter table public.ebay_listings
add column if not exists account_id uuid references public.ebay_accounts(id) on delete set null,
add column if not exists inventory_item_id text,
add column if not exists error_message text,
add column if not exists last_synced_at timestamptz;

-- Update sku to be unique if not already
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'ebay_listings_sku_key'
  ) then
    alter table public.ebay_listings
    add constraint ebay_listings_sku_key unique(sku);
  end if;
end $$;

create index if not exists idx_ebay_listings_account on public.ebay_listings(account_id);
create index if not exists idx_ebay_listings_status on public.ebay_listings(status);

-- 8) Update triggers for updated_at
drop trigger if exists trg_ebay_accounts_touch on public.ebay_accounts;
create trigger trg_ebay_accounts_touch
before update on public.ebay_accounts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ebay_tokens_touch on public.ebay_tokens;
create trigger trg_ebay_tokens_touch
before update on public.ebay_tokens
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ebay_policies_touch on public.ebay_policies;
create trigger trg_ebay_policies_touch
before update on public.ebay_policies
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ebay_templates_touch on public.ebay_templates;
create trigger trg_ebay_templates_touch
before update on public.ebay_templates
for each row execute function public.touch_updated_at();

drop trigger if exists trg_jobs_touch on public.jobs;
create trigger trg_jobs_touch
before update on public.jobs
for each row execute function public.touch_updated_at();

-- 9) Update inventory_lots.status enum if needed
-- Add 'listed' status if not present
do $$
begin
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'listed' 
    and enumtypid = (select oid from pg_type where typname = 'lot_status')
  ) then
    alter type public.lot_status add value 'listed';
  end if;
end $$;

-- 10) Function to log job events
create or replace function public.log_job_event(
  p_job_id uuid,
  p_level text,
  p_message text,
  p_meta jsonb default null
)
returns void
language plpgsql
as $$
begin
  insert into public.job_logs (job_id, level, message, meta)
  values (p_job_id, p_level, p_message, p_meta);
end $$;

grant execute on function public.log_job_event(uuid, text, text, jsonb) to authenticated;



