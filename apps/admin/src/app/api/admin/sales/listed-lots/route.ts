import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Fetch all listed lots that are for sale
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select(`
        id,
        condition,
        variation,
        quantity,
        for_sale,
        list_price_pence,
        status,
        card_id,
        cards (
          id,
          number,
          name,
          rarity,
          api_image_url,
          sets (
            id,
            name
          )
        )
      `)
      .eq("status", "listed")
      .eq("for_sale", true)
      .order("created_at", { ascending: false });

    if (lotsError) {
      console.error("Error fetching listed lots:", lotsError);
      return NextResponse.json(
        { error: lotsError.message || "Failed to fetch listed lots" },
        { status: 500 }
      );
    }

    // Get sold quantities from sales_items
    const lotIds = (lots || []).map((l: any) => l.id);
    const soldItemsMap = new Map<string, number>();
    
    if (lotIds.length > 0) {
      const { data: soldItems } = await supabase
        .from("sales_items")
        .select("lot_id, qty")
        .in("lot_id", lotIds);

      (soldItems || []).forEach((item: any) => {
        const current = soldItemsMap.get(item.lot_id) || 0;
        soldItemsMap.set(item.lot_id, current + (item.qty || 0));
      });
    }

    // Get purchase history for all lots
    const { data: purchaseHistory } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, acquisition_id, quantity")
      .in("lot_id", lotIds);

    const purchaseHistoryMap = new Map<string, Array<{ acquisition_id: string; quantity: number }>>();
    (purchaseHistory || []).forEach((ph: any) => {
      if (!purchaseHistoryMap.has(ph.lot_id)) {
        purchaseHistoryMap.set(ph.lot_id, []);
      }
      purchaseHistoryMap.get(ph.lot_id)!.push({
        acquisition_id: ph.acquisition_id,
        quantity: ph.quantity,
      });
    });

    // Get acquisition info
    const acquisitionIds = [
      ...new Set(
        (lots || []).map((l: any) => l.acquisition_id).filter(Boolean)
          .concat((purchaseHistory || []).map((ph: any) => ph.acquisition_id).filter(Boolean))
      ),
    ];

    const purchaseMap = new Map<string, any>();
    if (acquisitionIds.length > 0) {
      const { data: acquisitions } = await supabase
        .from("acquisitions")
        .select("id, source_name, source_type, purchased_at, status")
        .in("id", acquisitionIds);

      (acquisitions || []).forEach((acq: any) => {
        purchaseMap.set(acq.id, {
          id: acq.id,
          source_name: acq.source_name,
          source_type: acq.source_type,
          purchased_at: acq.purchased_at,
          status: acq.status,
        });
      });
    }

    // Format lots with available quantity
    const formattedLots = (lots || [])
      .map((lot: any) => {
        const soldQty = soldItemsMap.get(lot.id) || 0;
        const availableQty = Math.max(0, lot.quantity - soldQty);
        
        // Only return lots with available quantity
        if (availableQty <= 0) {
          return null;
        }

        // Get purchase history for this lot
        const history = purchaseHistoryMap.get(lot.id) || [];
        const purchases = history
          .map((h) => {
            const purchase = purchaseMap.get(h.acquisition_id);
            return purchase ? { ...purchase, quantity: h.quantity } : null;
          })
          .filter(Boolean) as Array<any>;
        
        // Fallback to single purchase if no history
        const purchase = lot.acquisition_id ? purchaseMap.get(lot.acquisition_id) : null;
        const singlePurchase = purchase && purchases.length === 0 ? purchase : null;
        const allPurchases = purchases.length > 0 
          ? purchases 
          : (singlePurchase ? [{ ...singlePurchase, quantity: lot.quantity }] : []);

        return {
          id: lot.id,
          condition: lot.condition,
          variation: lot.variation || "standard",
          quantity: lot.quantity,
          available_qty: availableQty,
          sold_qty: soldQty,
          list_price_pence: lot.list_price_pence,
          purchases: allPurchases, // Array of purchases with quantities
          card: lot.cards ? {
            id: lot.cards.id,
            number: lot.cards.number,
            name: lot.cards.name,
            rarity: lot.cards.rarity,
            api_image_url: lot.cards.api_image_url,
            set: lot.cards.sets ? {
              id: lot.cards.sets.id,
              name: lot.cards.sets.name,
            } : null,
          } : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      lots: formattedLots,
    });
  } catch (error: any) {
    console.error("Error in listed lots API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


