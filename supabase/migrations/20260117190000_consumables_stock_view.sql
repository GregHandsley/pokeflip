-- Add consumable stock tracking to v_consumable_costs
-- Stock is derived (purchased - used) so we don't need to maintain a separate counter.

create or replace view public.v_consumable_costs as
select
  c.id as consumable_id,
  c.name,
  c.unit,
  coalesce(p.total_purchased_qty, 0) as total_purchased_qty,
  coalesce(p.total_cost_pence, 0) as total_cost_pence,
  case
    when coalesce(p.total_purchased_qty, 0) > 0 then
      coalesce(p.total_cost_pence, 0)::numeric / p.total_purchased_qty::numeric
    else 0
  end as avg_cost_pence_per_unit,
  coalesce(u.total_used_qty, 0) as total_used_qty,
  (coalesce(p.total_purchased_qty, 0) - coalesce(u.total_used_qty, 0)) as in_stock_qty
from public.consumables c
left join (
  select
    consumable_id,
    coalesce(sum(qty), 0) as total_purchased_qty,
    coalesce(sum(total_cost_pence), 0) as total_cost_pence
  from public.consumable_purchases
  group by consumable_id
) p on p.consumable_id = c.id
left join (
  select
    consumable_id,
    coalesce(sum(qty), 0) as total_used_qty
  from public.sales_consumables
  group by consumable_id
) u on u.consumable_id = c.id;


