import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type SortOption = "price_desc" | "qty_desc" | "rarity_desc" | "updated_desc";
const FLOOR_GBP = Number(process.env.PRICE_FLOOR_GBP || "0.99");
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDraft = searchParams.get("includeDraft") === "true";
    const sort = (searchParams.get("sort") || "price_desc") as SortOption;
    const minPrice = searchParams.get("minPrice");
    const rarity = searchParams.get("rarity");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    const supabase = supabaseServer();

    // Build query from view
    let query = supabase
      .from("v_ebay_inbox_lots")
      .select("*", { count: "exact" });

    // Filter by draft status - view includes both, so filter if excluding draft
    if (!includeDraft) {
      query = query.eq("status", "ready");
    }

    // Apply filters
    if (minPrice) {
      const minPricePence = Math.round(parseFloat(minPrice) * 100);
      query = query.gte("list_price_pence", minPricePence);
    }

    if (rarity) {
      query = query.eq("rarity", rarity);
    }

    // Apply sorting
    switch (sort) {
      case "price_desc":
        query = query.order("list_price_pence", { ascending: false, nullsLast: true });
        break;
      case "qty_desc":
        query = query.order("available_qty", { ascending: false });
        break;
      case "rarity_desc":
        query = query.order("rarity_rank", { ascending: false });
        break;
      case "updated_desc":
        query = query.order("updated_at", { ascending: false });
        break;
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching inbox lots:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch inbox lots" },
        { status: 500 }
      );
    }

    // Fetch additional data: use_api_image flag and card API image URL
    const lotIds = (data || []).map((lot: any) => lot.lot_id);
    const cardIds = [...new Set((data || []).map((lot: any) => lot.card_id))];

    // Get use_api_image flags and card API image URLs
    const { data: lotsData } = await supabase
      .from("inventory_lots")
      .select("id, use_api_image, variation, card_id, cards!inner(api_image_url)")
      .in("id", lotIds);

    const lotMetadataMap = new Map();
    (lotsData || []).forEach((lot: any) => {
      lotMetadataMap.set(lot.id, {
        use_api_image: lot.use_api_image || false,
        api_image_url: lot.cards?.api_image_url || null,
        variation: lot.variation || "standard",
      });
    });

    // Get photo counts by kind (front/back)
    const { data: photosData } = await supabase
      .from("lot_photos")
      .select("lot_id, kind")
      .in("lot_id", lotIds)
      .in("kind", ["front", "back"]);

    const photoKindsMap = new Map<string, Set<string>>();
    (photosData || []).forEach((photo: any) => {
      if (!photoKindsMap.has(photo.lot_id)) {
        photoKindsMap.set(photo.lot_id, new Set());
      }
      photoKindsMap.get(photo.lot_id)!.add(photo.kind);
    });

    // Latest market snapshots per card (prefer most recent regardless of source; pricing step picks provider)
    let snapshotsMap = new Map<string, any>();
    if (cardIds.length > 0) {
      const { data: snaps } = await supabase
        .from("market_snapshots")
        .select("card_id, source, price_pence, captured_at, raw")
        .in("card_id", cardIds)
        .order("captured_at", { ascending: false });

      (snaps || []).forEach((s: any) => {
        if (!snapshotsMap.has(s.card_id)) {
          snapshotsMap.set(s.card_id, s);
        }
      });

      // For any cards without a snapshot, fetch one via our pricing endpoint (TCGdex) to prime the grid.
      const missingCardIds = cardIds.filter((cid) => !snapshotsMap.has(cid));
      if (missingCardIds.length > 0) {
        await Promise.all(
          missingCardIds.map(async (cid) => {
            try {
              const res = await fetch(`${ORIGIN}/api/admin/market/prices/${cid}`, {
                method: "GET",
              });
              const json = await res.json();
              if (res.ok && json?.chosen?.price_pence != null) {
                snapshotsMap.set(cid, {
                  card_id: cid,
                  price_pence: json.chosen.price_pence,
                  source: json.chosen.source,
                  captured_at: json.captured_at,
                  raw: json,
                });
              }
            } catch (e) {
              console.warn("Failed to prime market snapshot for card", cid, e);
            }
          })
        );
      }
    }

    // Enrich inbox lots with metadata + snapshot
    const enrichedData = (data || []).map((lot: any) => {
      const metadata = lotMetadataMap.get(lot.lot_id) || { use_api_image: false, api_image_url: null };
      const photoKinds = photoKindsMap.get(lot.lot_id) || new Set();
      const hasFront = photoKinds.has("front");
      const hasBack = photoKinds.has("back");
      const hasRequiredPhotos = hasFront && hasBack;

      const snap = snapshotsMap.get(lot.card_id);
      const market_price_pence = snap?.price_pence ?? null;
      const above_floor =
        typeof market_price_pence === "number" ? market_price_pence / 100 > FLOOR_GBP : false;

      return {
        ...lot,
        use_api_image: metadata.use_api_image,
        api_image_url: metadata.api_image_url,
        has_front_photo: hasFront,
        has_back_photo: hasBack,
        has_required_photos: hasRequiredPhotos || metadata.use_api_image,
        variation: metadata.variation,
        market_price_pence,
        above_floor,
      };
    });

    return NextResponse.json({
      ok: true,
      data: enrichedData,
      page,
      pageSize,
      totalCount: count || 0,
    });
  } catch (error: any) {
    console.error("Error in inbox lots API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

