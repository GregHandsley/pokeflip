-- =========================
-- Add discount tracking to sales_orders
-- =========================

alter table public.sales_orders
add column if not exists discount_pence int default 0 check (discount_pence >= 0);

create index if not exists idx_sales_orders_discount on public.sales_orders(discount_pence) where discount_pence > 0;

-- Update v_sales_order_profit view to include discount
-- Drop and recreate to avoid column ordering issues
drop view if exists public.v_sales_order_profit;

create view public.v_sales_order_profit as
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
  coalesce(so.discount_pence, 0) as discount_pence,
  -- Revenue from sales items (calculated separately to avoid cartesian product)
  coalesce(rc.revenue_pence, 0) as revenue_pence,
  -- Revenue after discount
  coalesce(rc.revenue_pence, 0) - coalesce(so.discount_pence, 0) as revenue_after_discount_pence,
  -- Consumables cost (calculated separately)
  coalesce(cc.consumables_cost_pence, 0) as consumables_cost_pence,
  -- Total costs
  coalesce(so.fees_pence, 0) + 
  coalesce(so.shipping_pence, 0) + 
  coalesce(cc.consumables_cost_pence, 0) as total_costs_pence,
  -- Net profit (revenue after discount minus costs)
  (coalesce(rc.revenue_pence, 0) - coalesce(so.discount_pence, 0)) - 
  (coalesce(so.fees_pence, 0) + 
   coalesce(so.shipping_pence, 0) + 
   coalesce(cc.consumables_cost_pence, 0)) as net_profit_pence,
  -- Margin percentage (based on revenue after discount)
  case 
    when (coalesce(rc.revenue_pence, 0) - coalesce(so.discount_pence, 0)) > 0 then
      (((coalesce(rc.revenue_pence, 0) - coalesce(so.discount_pence, 0)) - 
        (coalesce(so.fees_pence, 0) + 
         coalesce(so.shipping_pence, 0) + 
         coalesce(cc.consumables_cost_pence, 0)))::numeric / 
       (coalesce(rc.revenue_pence, 0) - coalesce(so.discount_pence, 0))::numeric * 100)
    else 0
  end as margin_percent
from public.sales_orders so
left join revenue_calc rc on rc.sales_order_id = so.id
left join consumables_calc cc on cc.sales_order_id = so.id;

