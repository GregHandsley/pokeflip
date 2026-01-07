-- =========================
-- Enable Row Level Security (RLS) on all tables
-- =========================
-- This migration enables RLS on all application tables and creates policies
-- for authenticated users. Since this is a single-user application, authenticated
-- users have full access to all tables.

-- Enable RLS on all main application tables
alter table if exists public.sets enable row level security;
alter table if exists public.cards enable row level security;
alter table if exists public.inventory_lots enable row level security;
alter table if exists public.ebay_listings enable row level security;
alter table if exists public.acquisitions enable row level security;
alter table if exists public.intake_lines enable row level security;
alter table if exists public.buyers enable row level security;
alter table if exists public.sales_orders enable row level security;
alter table if exists public.sales_items enable row level security;
alter table if exists public.consumables enable row level security;
alter table if exists public.consumable_purchases enable row level security;
alter table if exists public.sales_consumables enable row level security;
alter table if exists public.lot_photos enable row level security;
alter table if exists public.intake_line_photos enable row level security;
alter table if exists public.packaging_rules enable row level security;
alter table if exists public.packaging_rule_items enable row level security;
alter table if exists public.app_config enable row level security;
alter table if exists public.ebay_accounts enable row level security;
alter table if exists public.ebay_tokens enable row level security;
alter table if exists public.ebay_policies enable row level security;
alter table if exists public.ebay_templates enable row level security;
alter table if exists public.ebay_oauth_states enable row level security;
alter table if exists public.ebay_publish_jobs enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.job_logs enable row level security;
alter table if exists public.lot_purchase_history enable row level security;
alter table if exists public.market_snapshots enable row level security;
alter table if exists public.market_watchlist enable row level security;
alter table if exists public.price_alerts enable row level security;
alter table if exists public.promotional_deals enable row level security;
alter table if exists public.set_translations enable row level security;
alter table if exists public.bundles enable row level security;
alter table if exists public.bundle_items enable row level security;
alter table if exists public.bundle_photos enable row level security;
alter table if exists public.sales_item_purchase_allocations enable row level security;

-- =========================
-- Create RLS Policies for Authenticated Users
-- =========================
-- Since this is a single-user application, authenticated users need full access
-- to all tables. We'll create policies that allow SELECT, INSERT, UPDATE, DELETE
-- for authenticated users on all tables.

-- Helper function to create policies for a table
-- This function will be used to create consistent policies across all tables
create or replace function public.create_rls_policies_for_table(table_name text)
returns void
language plpgsql
security definer
as $$
begin
  -- Drop existing policies if they exist
  execute format('drop policy if exists "authenticated_select_%s" on %I', table_name, table_name);
  execute format('drop policy if exists "authenticated_insert_%s" on %I', table_name, table_name);
  execute format('drop policy if exists "authenticated_update_%s" on %I', table_name, table_name);
  execute format('drop policy if exists "authenticated_delete_%s" on %I', table_name, table_name);
  
  -- Create SELECT policy
  execute format('
    create policy "authenticated_select_%s"
    on %I
    for select
    to authenticated
    using (true)
  ', table_name, table_name);
  
  -- Create INSERT policy
  execute format('
    create policy "authenticated_insert_%s"
    on %I
    for insert
    to authenticated
    with check (true)
  ', table_name, table_name);
  
  -- Create UPDATE policy
  execute format('
    create policy "authenticated_update_%s"
    on %I
    for update
    to authenticated
    using (true)
    with check (true)
  ', table_name, table_name);
  
  -- Create DELETE policy
  execute format('
    create policy "authenticated_delete_%s"
    on %I
    for delete
    to authenticated
    using (true)
  ', table_name, table_name);
end;
$$;

-- Create policies for all tables
select public.create_rls_policies_for_table('sets');
select public.create_rls_policies_for_table('cards');
select public.create_rls_policies_for_table('inventory_lots');
select public.create_rls_policies_for_table('ebay_listings');
select public.create_rls_policies_for_table('acquisitions');
select public.create_rls_policies_for_table('intake_lines');
select public.create_rls_policies_for_table('buyers');
select public.create_rls_policies_for_table('sales_orders');
select public.create_rls_policies_for_table('sales_items');
select public.create_rls_policies_for_table('consumables');
select public.create_rls_policies_for_table('consumable_purchases');
select public.create_rls_policies_for_table('sales_consumables');
select public.create_rls_policies_for_table('lot_photos');
select public.create_rls_policies_for_table('intake_line_photos');
select public.create_rls_policies_for_table('packaging_rules');
select public.create_rls_policies_for_table('packaging_rule_items');
select public.create_rls_policies_for_table('app_config');
select public.create_rls_policies_for_table('ebay_accounts');
select public.create_rls_policies_for_table('ebay_tokens');
select public.create_rls_policies_for_table('ebay_policies');
select public.create_rls_policies_for_table('ebay_templates');
select public.create_rls_policies_for_table('ebay_oauth_states');
select public.create_rls_policies_for_table('ebay_publish_jobs');
select public.create_rls_policies_for_table('jobs');
select public.create_rls_policies_for_table('job_logs');
select public.create_rls_policies_for_table('lot_purchase_history');
select public.create_rls_policies_for_table('market_snapshots');
select public.create_rls_policies_for_table('market_watchlist');
select public.create_rls_policies_for_table('price_alerts');
select public.create_rls_policies_for_table('promotional_deals');
select public.create_rls_policies_for_table('set_translations');
select public.create_rls_policies_for_table('bundles');
select public.create_rls_policies_for_table('bundle_items');
select public.create_rls_policies_for_table('bundle_photos');
select public.create_rls_policies_for_table('sales_item_purchase_allocations');

-- Note: healthcheck table is intentionally excluded as it's a system table
-- that may need different access patterns

-- =========================
-- Grant Access to Views
-- =========================
-- Views need explicit grants, not RLS policies

grant select on public.v_card_inventory_totals to authenticated;
grant select on public.v_consumable_costs to authenticated;
grant select on public.v_sales_order_profit to authenticated;
grant select on public.v_ebay_inbox_lots to authenticated;

-- =========================
-- Grant Execute on Functions
-- =========================
-- Functions that are called by authenticated users need execute grants

grant execute on function public.commit_acquisition(uuid) to authenticated;
grant execute on function public.get_consumable_avg_cost(uuid) to authenticated;
grant execute on function public.generate_sku(text, text, text) to authenticated;
grant execute on function public.get_or_create_sku(text, text, text) to authenticated;
grant execute on function public.rarity_to_rank(text) to authenticated;
grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.touch_packaging_rules_updated_at() to authenticated;
grant execute on function public.update_bundle_updated_at() to authenticated;
grant execute on function public.update_lot_status_on_sale() to authenticated;
grant execute on function public.auto_create_lot_purchase_history() to authenticated;
grant execute on function public.cleanup_expired_oauth_states() to authenticated;
grant execute on function public.log_job_event(uuid, text, text, jsonb) to authenticated;
grant execute on function public.update_set_translations_updated_at() to authenticated;

-- =========================
-- Cleanup Helper Function
-- =========================
-- Remove the helper function after use (optional, but keeps schema clean)
drop function if exists public.create_rls_policies_for_table(text);

