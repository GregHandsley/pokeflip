import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ acquisitionId: string }> }
) {
  try {
    const { acquisitionId } = await params;
    const supabase = supabaseServer();

    // Fetch the acquisition/purchase info
    const { data: acquisition, error: acqError } = await supabase
      .from("acquisitions")
      .select("*")
      .eq("id", acquisitionId)
      .single();

    if (acqError || !acquisition) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Fetch purchase history to find all lots that have cards from this purchase
    // This includes merged lots that may no longer have acquisition_id set
    const { data: purchaseHistory, error: historyError } = await supabase
      .from("lot_purchase_history")
      .select("lot_id, quantity")
      .eq("acquisition_id", acquisitionId);

    if (historyError) {
      console.error("Error fetching purchase history:", historyError);
      return NextResponse.json(
        { error: "Failed to fetch purchase history" },
        { status: 500 }
      );
    }

    // Get all lot IDs from purchase history (these are the lots that have cards from this purchase)
    const historyLotIds = (purchaseHistory || []).map((ph: any) => ph.lot_id);
    
    // Also get lots that directly have this acquisition_id (for backwards compatibility)
    const { data: directLots, error: directLotsError } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("acquisition_id", acquisitionId);

    if (directLotsError) {
      console.error("Error fetching direct lots:", directLotsError);
    }

    const directLotIds = (directLots || []).map((l: any) => l.id);
    
    // Combine both sets of lot IDs
    const allLotIds = [...new Set([...historyLotIds, ...directLotIds])];

    if (allLotIds.length === 0) {
      return NextResponse.json({
        ok: true,
        purchase: {
          id: acquisition.id,
          source_name: acquisition.source_name,
          source_type: acquisition.source_type,
          purchase_total_pence: acquisition.purchase_total_pence,
          purchased_at: acquisition.purchased_at,
          notes: acquisition.notes,
          status: acquisition.status,
          created_at: acquisition.created_at,
        },
        lots: [],
      });
    }

    // Fetch all lots (including merged ones)
    const { data: lots, error: lotsError } = await supabase
      .from("inventory_lots")
      .select(`
        *,
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
      .in("id", allLotIds)
      .order("created_at", { ascending: false });

    if (lotsError) {
      console.error("Error fetching cards:", lotsError);
      return NextResponse.json(
        { error: lotsError.message || "Failed to fetch cards" },
        { status: 500 }
      );
    }

    // Create a map of lot_id -> original quantity from this purchase
    const purchaseQuantityMap = new Map<string, number>();
    (purchaseHistory || []).forEach((ph: any) => {
      purchaseQuantityMap.set(ph.lot_id, ph.quantity);
    });

    // For lots that don't have purchase history but have acquisition_id, use their current quantity
    (lots || []).forEach((lot: any) => {
      if (lot.acquisition_id === acquisitionId && !purchaseQuantityMap.has(lot.id)) {
        purchaseQuantityMap.set(lot.id, lot.quantity);
      }
    });

    const lotIds = (lots || []).map((l: any) => l.id);

    // Get sold quantities from sales_items
    const soldItemsMap = new Map<string, number>();
    // Also track sold quantities by purchase (for merged lots)
    const soldByPurchaseMap = new Map<string, number>(); // lot_id -> qty sold from this purchase
    
    if (lotIds.length > 0) {
      const { data: soldItems } = await supabase
        .from("sales_items")
        .select("id, lot_id, qty")
        .in("lot_id", lotIds);

      const soldItemIds = (soldItems || []).map((si: any) => si.id);
      
      // Get purchase allocations for sold items to track which purchase they came from
      if (soldItemIds.length > 0) {
        const { data: purchaseAllocations } = await supabase
          .from("sales_item_purchase_allocations")
          .select("sales_item_id, acquisition_id, qty")
          .in("sales_item_id", soldItemIds)
          .eq("acquisition_id", acquisitionId);

        // Map sales_item_id to lot_id
        const salesItemToLotMap = new Map<string, string>();
        (soldItems || []).forEach((si: any) => {
          salesItemToLotMap.set(si.id, si.lot_id);
        });

        // Track sold quantities from this purchase per lot
        (purchaseAllocations || []).forEach((alloc: any) => {
          const lotId = salesItemToLotMap.get(alloc.sales_item_id);
          if (lotId) {
            const current = soldByPurchaseMap.get(lotId) || 0;
            soldByPurchaseMap.set(lotId, current + (alloc.qty || 0));
          }
        });
      }

      // Also track total sold per lot (for backwards compatibility with items without allocations)
      (soldItems || []).forEach((item: any) => {
        const current = soldItemsMap.get(item.lot_id) || 0;
        soldItemsMap.set(item.lot_id, current + (item.qty || 0));
      });
    }

    // Get eBay listing statuses
    const ebayMap = new Map();
    if (lotIds.length > 0) {
      const { data: ebayListings } = await supabase
        .from("ebay_listings")
        .select("lot_id, status")
        .in("lot_id", lotIds);

      (ebayListings || []).forEach((listing: any) => {
        ebayMap.set(listing.lot_id, listing.status);
      });
    }

    // Get photo counts
    const photoCountsMap = new Map<string, number>();
    if (lotIds.length > 0) {
      const { data: photos } = await supabase
        .from("lot_photos")
        .select("lot_id")
        .in("lot_id", lotIds);

      (photos || []).forEach((photo: any) => {
        const current = photoCountsMap.get(photo.lot_id) || 0;
        photoCountsMap.set(photo.lot_id, current + 1);
      });
    }

    // Format lots with available qty and related data
    // Use original quantity from this purchase (from purchase history) for display
    const formattedLots = (lots || []).map((lot: any) => {
      // Get the original quantity from this purchase (before merge)
      const originalQtyFromPurchase = purchaseQuantityMap.get(lot.id) || lot.quantity;
      
      // Get sold quantity from this purchase (using purchase allocations if available)
      let soldQtyFromPurchase = soldByPurchaseMap.get(lot.id) || 0;
      
      // If no purchase allocation data, fall back to proportional calculation
      if (soldQtyFromPurchase === 0) {
        const totalSoldQty = soldItemsMap.get(lot.id) || 0;
        const currentLotQty = lot.quantity;
        if (currentLotQty > 0 && totalSoldQty > 0) {
          // Calculate proportion: how much of this lot came from this purchase
          const proportionFromPurchase = originalQtyFromPurchase / currentLotQty;
          soldQtyFromPurchase = Math.floor(totalSoldQty * proportionFromPurchase);
        }
      }
      
      const availableQtyFromPurchase = Math.max(0, originalQtyFromPurchase - soldQtyFromPurchase);

      return {
        id: lot.id,
        card_id: lot.card_id,
        condition: lot.condition,
        variation: lot.variation || null,
        quantity: originalQtyFromPurchase, // Show original quantity from this purchase
        available_qty: availableQtyFromPurchase, // Available from this purchase
        sold_qty: soldQtyFromPurchase, // Sold from this purchase
        for_sale: lot.for_sale,
        list_price_pence: lot.list_price_pence,
        status: lot.status,
        note: lot.note,
        created_at: lot.created_at,
        updated_at: lot.updated_at,
        ebay_status: ebayMap.get(lot.id) || "not_listed",
        photo_count: photoCountsMap.get(lot.id) || 0,
        is_merged: lot.acquisition_id !== acquisitionId, // Indicate if this is a merged lot
        card: lot.cards ? {
          id: lot.cards.id,
          number: lot.cards.number,
          name: lot.cards.name,
          rarity: lot.cards.rarity,
          image_url: lot.cards.api_image_url,
          set: lot.cards.sets ? {
            id: lot.cards.sets.id,
            name: lot.cards.sets.name,
          } : null,
        } : null,
      };
    });

    // Also fetch draft intake lines to show uncommitted cards
    const { data: draftLines, error: draftError } = await supabase
      .from("intake_lines")
      .select(`
        id,
        card_id,
        set_id,
        condition,
        variation,
        quantity,
        for_sale,
        list_price_pence,
        note,
        created_at,
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
      .eq("acquisition_id", acquisitionId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (draftError) {
      console.error("Error fetching draft lines:", draftError);
    }

    // Format draft lines to match lot structure
    const formattedDraftLines = (draftLines || []).map((line: any) => ({
      id: `draft-${line.id}`, // Prefix to distinguish from real lots
      card_id: line.card_id,
      condition: line.condition,
      variation: line.variation || null,
      quantity: line.quantity,
      available_qty: line.quantity, // All available since not committed
      sold_qty: 0, // None sold since not in inventory
      for_sale: line.for_sale,
      list_price_pence: line.list_price_pence,
      status: "draft" as const,
      note: line.note,
      created_at: line.created_at,
      updated_at: line.created_at,
      ebay_status: "not_listed" as const,
      photo_count: 0,
      is_draft: true, // Flag to indicate this is a draft line
      card: line.cards ? {
        id: line.cards.id,
        number: line.cards.number,
        name: line.cards.name,
        rarity: line.cards.rarity,
        image_url: line.cards.api_image_url,
        set: line.cards.sets ? {
          id: line.cards.sets.id,
          name: line.cards.sets.name,
        } : null,
      } : null,
    }));

    // Combine committed lots and draft lines
    const allItems = [...formattedLots, ...formattedDraftLines];

    return NextResponse.json({
      ok: true,
      purchase: {
        id: acquisition.id,
        source_name: acquisition.source_name,
        source_type: acquisition.source_type,
        purchase_total_pence: acquisition.purchase_total_pence,
        purchased_at: acquisition.purchased_at,
        notes: acquisition.notes,
        status: acquisition.status,
        created_at: acquisition.created_at,
      },
      lots: allItems,
    });
  } catch (error: any) {
    console.error("Error in purchase lots API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

