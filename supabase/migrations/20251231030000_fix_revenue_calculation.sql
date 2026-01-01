-- =========================
-- Fix revenue calculation in v_sales_order_profit view
-- The issue was that joining sales_items with sales_consumables created
-- a cartesian product, causing revenue to be multiplied by the number of consumables
-- =========================

-- Drop and recreate the view with proper subqueries to avoid cartesian product
create or replace view public.v_sales_order_profit as
with revenue_calc as (
  select
    sales_order_id,
    sum(sold_price_pence * qty) as revenue_pence
  from public.sales_items
  group by sales_order_id
),
consumables_calc as (
  select
    sc.sales_order_id,
    sum(sc.qty * coalesce(vcc.avg_cost_pence_per_unit, 0)) as consumables_cost_pence
  from public.sales_consumables sc
  left join public.v_consumable_costs vcc on vcc.consumable_id = sc.consumable_id
  group by sc.sales_order_id
)
select
  so.id as sales_order_id,
  so.sold_at,
  so.fees_pence,
  so.shipping_pence,
  -- Revenue from sales items (calculated separately to avoid cartesian product)
  coalesce(rc.revenue_pence, 0) as revenue_pence,
  -- Consumables cost (calculated separately)
  coalesce(cc.consumables_cost_pence, 0) as consumables_cost_pence,
  -- Total costs
  coalesce(so.fees_pence, 0) + 
  coalesce(so.shipping_pence, 0) + 
  coalesce(cc.consumables_cost_pence, 0) as total_costs_pence,
  -- Net profit
  coalesce(rc.revenue_pence, 0) - 
  (coalesce(so.fees_pence, 0) + 
   coalesce(so.shipping_pence, 0) + 
   coalesce(cc.consumables_cost_pence, 0)) as net_profit_pence,
  -- Margin percentage
  case 
    when coalesce(rc.revenue_pence, 0) > 0 then
      ((coalesce(rc.revenue_pence, 0) - 
        (coalesce(so.fees_pence, 0) + 
         coalesce(so.shipping_pence, 0) + 
         coalesce(cc.consumables_cost_pence, 0)))::numeric / 
       rc.revenue_pence::numeric * 100)
    else 0
  end as margin_percent
from public.sales_orders so
left join revenue_calc rc on rc.sales_order_id = so.id
left join consumables_calc cc on cc.sales_order_id = so.id;

