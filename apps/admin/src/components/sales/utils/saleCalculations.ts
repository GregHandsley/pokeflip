import type { SaleItem, PromotionalDeal, ConsumableSelection } from "../types";

export function autoAllocatePurchases(item: SaleItem) {
  const purchases = item.lot?.purchases || [];
  if (purchases.length === 0 || purchases.length === 1) {
    return purchases.length === 1 ? [{ purchaseId: purchases[0].id, qty: item.qty }] : [];
  }

  const totalAvailable = purchases.reduce((sum, p) => sum + p.quantity, 0);
  if (totalAvailable === 0) return [];

  const allocations: Array<{ purchaseId: string; qty: number }> = [];
  let remainingQty = item.qty;

  const sortedPurchases = [...purchases].sort((a, b) => b.quantity - a.quantity);

  for (let i = 0; i < sortedPurchases.length && remainingQty > 0; i++) {
    const purchase = sortedPurchases[i];
    const proportion = purchase.quantity / totalAvailable;
    const allocatedQty =
      i === sortedPurchases.length - 1
        ? remainingQty
        : Math.max(1, Math.floor(item.qty * proportion));

    const finalQty = Math.min(allocatedQty, purchase.quantity, remainingQty);
    if (finalQty > 0) {
      allocations.push({ purchaseId: purchase.id, qty: finalQty });
      remainingQty -= finalQty;
    }
  }

  return allocations;
}

export function calculateDealDiscount(
  items: SaleItem[],
  deal: PromotionalDeal
): { type: string; amount: number } | null {
  if (!deal.is_active) return null;

  const totalCardCount = items.reduce((sum, item) => sum + item.qty, 0);
  const nonFreeItems = items.filter(
    (item) => !item.isFree && item.pricePence && item.pricePence > 0
  );
  const totalRevenue = nonFreeItems.reduce((sum, item) => sum + item.pricePence! * item.qty, 0);

  if (totalCardCount < deal.min_card_count) return null;
  if (deal.max_card_count && totalCardCount > deal.max_card_count) return null;

  let discountAmount = 0;

  switch (deal.deal_type) {
    case "percentage_off":
      if (deal.discount_percent) {
        discountAmount = (totalRevenue * deal.discount_percent) / 100;
      }
      break;
    case "fixed_off":
      if (deal.discount_amount_pence) {
        discountAmount = deal.discount_amount_pence;
      }
      break;
    case "free_shipping":
      discountAmount = 0;
      break;
    case "buy_x_get_y":
      if (deal.buy_quantity && deal.get_quantity && deal.discount_percent != null) {
        const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
        if (totalQty >= deal.buy_quantity) {
          const cycles = Math.floor(totalQty / deal.buy_quantity);
          const discountedQty = cycles * deal.get_quantity;
          if (discountedQty > 0) {
            const sortedItems = [...nonFreeItems].sort(
              (a, b) => (a.pricePence || 0) - (b.pricePence || 0)
            );
            let qtyToDiscount = Math.min(discountedQty, totalQty);
            for (const item of sortedItems) {
              if (qtyToDiscount <= 0) break;
              const discountThisItem = Math.min(item.qty, qtyToDiscount);
              if (deal.discount_percent === 100) {
                discountAmount += item.pricePence! * discountThisItem;
              } else {
                discountAmount +=
                  (item.pricePence! * discountThisItem * deal.discount_percent) / 100;
              }
              qtyToDiscount -= discountThisItem;
            }
          }
        }
      }
      break;
  }

  return { type: deal.deal_type, amount: discountAmount };
}

export function calculateTotals(
  saleItems: SaleItem[],
  fees: string,
  shipping: string,
  selectedConsumables: ConsumableSelection[],
  dealDiscount: { type: string; amount: number } | null,
  selectedDealId: string | null
) {
  const totalRevenue = saleItems.reduce(
    (sum, item) => sum + (item.pricePence ? item.pricePence * item.qty : 0),
    0
  );

  const discountAmount = dealDiscount?.amount || 0;
  const revenueAfterDiscount = Math.max(0, totalRevenue / 100 - discountAmount / 100);

  const feesCost = parseFloat(fees) || 0;
  const shippingCost =
    selectedDealId && dealDiscount?.type === "free_shipping" ? 0 : parseFloat(shipping) || 0;
  const consumablesCost = selectedConsumables.reduce(
    (sum, c) => sum + (c.qty * c.unit_cost_pence) / 100,
    0
  );
  const totalCosts = feesCost + shippingCost + consumablesCost;
  const netProfit = revenueAfterDiscount - totalCosts;
  const margin = revenueAfterDiscount > 0 ? (netProfit / revenueAfterDiscount) * 100 : 0;

  return {
    revenue: totalRevenue / 100,
    discount: discountAmount / 100,
    revenueAfterDiscount,
    feesCost,
    shippingCost,
    consumablesCost,
    totalCosts,
    netProfit,
    margin,
  };
}
