-- =========================
-- Packaging Recipes and Profit Tracking
-- =========================

-- Packaging recipe rules table
create table if not exists public.packaging_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Default',
  is_default boolean not null default false,
  card_count_min int not null default 1,
  card_count_max int, -- null means unlimited
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Packaging rule items (consumables per rule)
create table if not exists public.packaging_rule_items (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.packaging_rules(id) on delete cascade,
  consumable_id uuid not null references public.consumables(id) on delete restrict,
  qty int not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  unique(rule_id, consumable_id)
);

-- Indexes
create unique index if not exists idx_packaging_rules_default_unique on public.packaging_rules(is_default) where is_default = true;
create index if not exists idx_packaging_rules_default on public.packaging_rules(is_default);
create index if not exists idx_packaging_rule_items_rule on public.packaging_rule_items(rule_id);
create index if not exists idx_consumable_purchases_consumable on public.consumable_purchases(consumable_id);
create index if not exists idx_sales_consumables_order on public.sales_consumables(sales_order_id);

-- Function to calculate running average cost for a consumable
create or replace function public.get_consumable_avg_cost(p_consumable_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_avg_cost numeric;
begin
  select 
    case 
      when sum(qty) > 0 then sum(total_cost_pence)::numeric / sum(qty)::numeric
      else 0
    end
  into v_avg_cost
  from public.consumable_purchases
  where consumable_id = p_consumable_id;
  
  return coalesce(v_avg_cost, 0);
end;
$$;

-- View for consumable costs with running average
create or replace view public.v_consumable_costs as
select
  c.id as consumable_id,
  c.name,
  c.unit,
  coalesce(sum(cp.qty), 0) as total_purchased_qty,
  coalesce(sum(cp.total_cost_pence), 0) as total_cost_pence,
  case 
    when sum(cp.qty) > 0 then sum(cp.total_cost_pence)::numeric / sum(cp.qty)::numeric
    else 0
  end as avg_cost_pence_per_unit
from public.consumables c
left join public.consumable_purchases cp on cp.consumable_id = c.id
group by c.id, c.name, c.unit;

-- View for sales order profit calculation
create or replace view public.v_sales_order_profit as
select
  so.id as sales_order_id,
  so.sold_at,
  so.fees_pence,
  so.shipping_pence,
  -- Revenue from sales items
  coalesce(sum(si.sold_price_pence * si.qty), 0) as revenue_pence,
  -- Consumables cost (using running average)
  coalesce(
    sum(
      sc.qty * coalesce(vcc.avg_cost_pence_per_unit, 0)
    ),
    0
  ) as consumables_cost_pence,
  -- Total costs
  coalesce(so.fees_pence, 0) + 
  coalesce(so.shipping_pence, 0) + 
  coalesce(
    sum(
      sc.qty * coalesce(vcc.avg_cost_pence_per_unit, 0)
    ),
    0
  ) as total_costs_pence,
  -- Net profit
  coalesce(sum(si.sold_price_pence * si.qty), 0) - 
  (coalesce(so.fees_pence, 0) + 
   coalesce(so.shipping_pence, 0) + 
   coalesce(
     sum(
       sc.qty * coalesce(vcc.avg_cost_pence_per_unit, 0)
     ),
     0
   )) as net_profit_pence,
  -- Margin percentage
  case 
    when sum(si.sold_price_pence * si.qty) > 0 then
      ((coalesce(sum(si.sold_price_pence * si.qty), 0) - 
        (coalesce(so.fees_pence, 0) + 
         coalesce(so.shipping_pence, 0) + 
         coalesce(
           sum(
             sc.qty * coalesce(vcc.avg_cost_pence_per_unit, 0)
           ),
           0
         )))::numeric / 
       sum(si.sold_price_pence * si.qty)::numeric * 100)
    else 0
  end as margin_percent
from public.sales_orders so
left join public.sales_items si on si.sales_order_id = so.id
left join public.sales_consumables sc on sc.sales_order_id = so.id
left join public.v_consumable_costs vcc on vcc.consumable_id = sc.consumable_id
group by so.id, so.sold_at, so.fees_pence, so.shipping_pence;

-- Trigger to update packaging_rules updated_at
create or replace function public.touch_packaging_rules_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_packaging_rules_touch on public.packaging_rules;
create trigger trg_packaging_rules_touch
before update on public.packaging_rules
for each row execute function public.touch_packaging_rules_updated_at();

