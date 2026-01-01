-- Market snapshots and alerts

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.cards(id) on delete cascade,
  source text not null default 'cardmarket',
  price_pence int not null,
  currency text not null default 'GBP',
  captured_at timestamptz not null default now(),
  raw jsonb
);

create index if not exists idx_market_snapshots_card_captured on public.market_snapshots(card_id, captured_at desc);
create index if not exists idx_market_snapshots_source on public.market_snapshots(source);

create table if not exists public.market_watchlist (
  card_id text primary key references public.cards(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.cards(id) on delete cascade,
  source text not null default 'cardmarket',
  old_price_pence int,
  new_price_pence int not null,
  delta_pct numeric,
  triggered_at timestamptz not null default now(),
  threshold_pct numeric,
  note text
);

create index if not exists idx_price_alerts_card on public.price_alerts(card_id, triggered_at desc);

