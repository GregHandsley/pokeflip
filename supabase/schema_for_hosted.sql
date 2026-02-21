-- Run this in Supabase Dashboard → SQL Editor on your empty hosted project.
-- Creates enums, tables in dependency order, and the lot-status trigger.
-- Safe to run again: enums and tables are created only if they don't exist.

-- ========== ENUMS (must exist before tables that use them) ==========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'acquisition_status') THEN
    CREATE TYPE public.acquisition_status AS ENUM ('open', 'closed');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ebay_listing_status') THEN
    CREATE TYPE public.ebay_listing_status AS ENUM ('not_listed', 'pending', 'live', 'ended', 'failed');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intake_status') THEN
    CREATE TYPE public.intake_status AS ENUM ('draft', 'committed');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lot_status') THEN
    CREATE TYPE public.lot_status AS ENUM ('draft', 'ready', 'listed', 'sold', 'archived');
  END IF;
END $$;

-- ========== TABLES (dependency order) ==========

CREATE TABLE IF NOT EXISTS public.sets (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  series text,
  release_date date,
  api_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id text NOT NULL PRIMARY KEY,
  set_id text NOT NULL REFERENCES public.sets(id),
  number text NOT NULL,
  name text NOT NULL,
  rarity text,
  api_image_url text,
  api_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.acquisitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name text NOT NULL,
  source_type text NOT NULL DEFAULT 'other',
  reference text,
  purchase_total_pence integer NOT NULL CHECK (purchase_total_pence >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  status public.acquisition_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.buyers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL DEFAULT 'ebay',
  handle text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consumables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'each',
  created_at timestamptz NOT NULL DEFAULT now(),
  low_stock_threshold integer NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0)
);

CREATE TABLE IF NOT EXISTS public.packaging_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Default',
  is_default boolean NOT NULL DEFAULT false,
  card_count_min integer NOT NULL DEFAULT 1,
  card_count_max integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotional_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  deal_type text NOT NULL CHECK (deal_type IN ('percentage_off', 'fixed_off', 'free_shipping', 'buy_x_get_y')),
  discount_percent numeric,
  discount_amount_pence integer,
  buy_quantity integer,
  get_quantity integer,
  min_card_count integer DEFAULT 1,
  max_card_count integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key text NOT NULL PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,
  user_email text,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  description text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.healthcheck (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_pence integer NOT NULL CHECK (price_pence > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id text NOT NULL REFERENCES public.cards(id),
  condition text NOT NULL CHECK (condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
  quantity integer NOT NULL CHECK (quantity >= 0),
  for_sale boolean NOT NULL DEFAULT true,
  list_price_pence integer,
  note text,
  photo_front_path text,
  photo_back_path text,
  status public.lot_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  acquisition_id uuid REFERENCES public.acquisitions(id),
  ebay_publish_queued_at timestamptz,
  ebay_last_error text,
  use_api_image boolean NOT NULL DEFAULT false,
  item_number text,
  variation text NOT NULL DEFAULT 'standard' CHECK (variation IN ('standard', 'holo', 'reverse_holo', 'first_edition', 'master_ball', 'stamped', 'promo', 'shadowless', 'non_holo'))
);

CREATE TABLE IF NOT EXISTS public.intake_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acquisition_id uuid NOT NULL REFERENCES public.acquisitions(id),
  set_id text NOT NULL REFERENCES public.sets(id),
  card_id text NOT NULL REFERENCES public.cards(id),
  condition text NOT NULL CHECK (condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
  quantity integer NOT NULL CHECK (quantity > 0),
  for_sale boolean NOT NULL DEFAULT true,
  list_price_pence integer,
  note text,
  status public.intake_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  variation text NOT NULL DEFAULT 'standard' CHECK (variation IN ('standard', 'holo', 'reverse_holo', 'first_edition', 'master_ball', 'stamped', 'promo', 'shadowless', 'non_holo'))
);

CREATE TABLE IF NOT EXISTS public.ebay_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  environment text NOT NULL DEFAULT 'sandbox' UNIQUE CHECK (environment IN ('production', 'sandbox')),
  seller_username text,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ebay_oauth_states (
  state text NOT NULL PRIMARY KEY,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ebay_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL UNIQUE REFERENCES public.ebay_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  token_type text NOT NULL DEFAULT 'Bearer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ebay_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL UNIQUE REFERENCES public.ebay_accounts(id) ON DELETE CASCADE,
  fulfillment_policy_id text,
  payment_policy_id text,
  return_policy_id text,
  location_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ebay_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL UNIQUE REFERENCES public.ebay_accounts(id) ON DELETE CASCADE,
  title_template text NOT NULL DEFAULT '{{card.name}} {{set.name}} {{card.number}} {{rarity}} {{condition}}',
  description_template text NOT NULL,
  category_id text,
  listing_duration text NOT NULL DEFAULT 'GTC',
  currency text NOT NULL DEFAULT 'GBP',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lot_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES public.inventory_lots(id),
  kind text NOT NULL CHECK (kind IN ('front', 'back', 'extra')),
  object_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intake_line_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intake_line_id uuid NOT NULL REFERENCES public.intake_lines(id),
  kind text NOT NULL CHECK (kind IN ('front', 'back', 'extra')),
  object_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL DEFAULT 'ebay',
  platform_order_ref text,
  buyer_id uuid REFERENCES public.buyers(id),
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  order_group text,
  fees_pence integer CHECK (fees_pence >= 0),
  shipping_pence integer CHECK (shipping_pence >= 0),
  discount_pence integer DEFAULT 0 CHECK (discount_pence >= 0),
  bundle_id uuid REFERENCES public.bundles(id)
);

CREATE TABLE IF NOT EXISTS public.sales_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id),
  lot_id uuid NOT NULL REFERENCES public.inventory_lots(id),
  qty integer NOT NULL CHECK (qty > 0),
  sold_price_pence integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  purchase_id uuid REFERENCES public.acquisitions(id)
);

CREATE TABLE IF NOT EXISTS public.sales_consumables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id),
  consumable_id uuid NOT NULL REFERENCES public.consumables(id),
  qty integer NOT NULL CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS public.sales_item_purchase_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_item_id uuid NOT NULL REFERENCES public.sales_items(id),
  acquisition_id uuid NOT NULL REFERENCES public.acquisitions(id),
  qty integer NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundle_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id uuid NOT NULL REFERENCES public.bundles(id),
  lot_id uuid NOT NULL REFERENCES public.inventory_lots(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundle_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id uuid NOT NULL REFERENCES public.bundles(id),
  kind text NOT NULL DEFAULT 'bundle' CHECK (kind = 'bundle'),
  object_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lot_purchase_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES public.inventory_lots(id),
  acquisition_id uuid NOT NULL REFERENCES public.acquisitions(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ebay_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL UNIQUE REFERENCES public.inventory_lots(id),
  sku text NOT NULL UNIQUE,
  offer_id text,
  listing_id text,
  status public.ebay_listing_status NOT NULL DEFAULT 'not_listed',
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid REFERENCES public.ebay_accounts(id),
  inventory_item_id text,
  error_message text
);

CREATE TABLE IF NOT EXISTS public.ebay_publish_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES public.inventory_lots(id),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consumable_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consumable_id uuid NOT NULL REFERENCES public.consumables(id),
  qty integer NOT NULL CHECK (qty > 0),
  total_cost_pence integer NOT NULL CHECK (total_cost_pence >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.packaging_rule_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id uuid NOT NULL REFERENCES public.packaging_rules(id),
  consumable_id uuid NOT NULL REFERENCES public.consumables(id),
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_watchlist (
  card_id text NOT NULL PRIMARY KEY REFERENCES public.cards(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id text NOT NULL REFERENCES public.cards(id),
  source text NOT NULL DEFAULT 'cardmarket',
  price_pence integer NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  captured_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id text NOT NULL REFERENCES public.cards(id),
  source text NOT NULL DEFAULT 'cardmarket',
  old_price_pence integer,
  new_price_pence integer NOT NULL,
  delta_pct numeric,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  threshold_pct numeric,
  note text
);

CREATE TABLE IF NOT EXISTS public.job_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.set_translations (
  set_id text NOT NULL PRIMARY KEY REFERENCES public.sets(id),
  name_en text NOT NULL,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_language text
);

-- ========== TRIGGER: auto-update lot status when items are sold ==========
CREATE OR REPLACE FUNCTION public.update_lot_status_on_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lot_id uuid;
  v_sold_qty int;
  v_lot_quantity int;
BEGIN
  v_lot_id := coalesce(NEW.lot_id, OLD.lot_id);
  IF v_lot_id IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  SELECT coalesce(sum(qty), 0)::int INTO v_sold_qty
  FROM public.sales_items WHERE lot_id = v_lot_id;

  SELECT quantity INTO v_lot_quantity
  FROM public.inventory_lots WHERE id = v_lot_id;

  IF v_sold_qty >= v_lot_quantity THEN
    UPDATE public.inventory_lots SET status = 'sold'::public.lot_status
    WHERE id = v_lot_id AND status != 'sold';
  ELSIF v_sold_qty = 0 THEN
    UPDATE public.inventory_lots
    SET status = CASE WHEN status = 'sold' THEN 'ready'::public.lot_status ELSE status END
    WHERE id = v_lot_id AND status = 'sold';
  END IF;

  RETURN coalesce(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_update_lot_status_on_sale_insert ON public.sales_items;
CREATE TRIGGER trg_update_lot_status_on_sale_insert
  AFTER INSERT ON public.sales_items
  FOR EACH ROW EXECUTE FUNCTION public.update_lot_status_on_sale();

DROP TRIGGER IF EXISTS trg_update_lot_status_on_sale_update ON public.sales_items;
CREATE TRIGGER trg_update_lot_status_on_sale_update
  AFTER UPDATE ON public.sales_items
  FOR EACH ROW EXECUTE FUNCTION public.update_lot_status_on_sale();

DROP TRIGGER IF EXISTS trg_update_lot_status_on_sale_delete ON public.sales_items;
CREATE TRIGGER trg_update_lot_status_on_sale_delete
  AFTER DELETE ON public.sales_items
  FOR EACH ROW EXECUTE FUNCTION public.update_lot_status_on_sale();

-- Optional: insert one row into healthcheck so /api/health succeeds (only if empty)
INSERT INTO public.healthcheck (created_at)
SELECT now() WHERE NOT EXISTS (SELECT 1 FROM public.healthcheck LIMIT 1);
