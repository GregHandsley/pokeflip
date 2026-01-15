import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { createApiLogger } from "@/lib/logger";

type SortOption = "price_desc" | "qty_desc" | "rarity_desc" | "updated_desc";

type VebayInboxLotRow = {
  lot_id: string;
  card_id: string;
  list_price_pence: number | null;
  available_qty: number;
  rarity: string | null;
  rarity_rank: number | null;
  updated_at: string;
  status: string;
  [key: string]: unknown;
};

type LotWithCardRow = {
  id: string;
  use_api_image: boolean;
  variation: string | null;
  card_id: string;
  cards:
    | {
        api_image_url: string | null;
      }
    | {
        api_image_url: string | null;
      }[]
    | null;
};

type PhotoRow = {
  lot_id: string;
  kind: string;
};

type MarketSnapshotRow = {
  card_id: string;
  source: string;
  price_pence: number | null;
  captured_at: string;
  raw: unknown;
};

type EnrichedSnapshot = {
  card_id: string;
  price_pence: number | null;
  source: string;
  captured_at: string;
  raw: unknown;
};

import { app } from "@/lib/config/env";

const FLOOR_GBP = app().priceFloorGbp;
const ORIGIN = app().siteUrl;

export async function GET(req: Request) {
  const logger = createApiLogger(req);

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
    let query = supabase.from("v_ebay_inbox_lots").select("*", { count: "exact" });

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
        query = query.order("list_price_pence", { ascending: false, nullsFirst: false });
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
      logger.error("Failed to fetch inbox lots", error, undefined, {
        includeDraft,
        sort,
        page,
        pageSize,
      });
      return createErrorResponse(
        error.message || "Failed to fetch inbox lots",
        500,
        "FETCH_INBOX_LOTS_FAILED",
        error
      );
    }

    // Fetch additional data: use_api_image flag and card API image URL
    const lotIds = (data || []).map((lot: VebayInboxLotRow) => lot.lot_id);
    const cardIds = [...new Set((data || []).map((lot: VebayInboxLotRow) => lot.card_id))];

    // Get use_api_image flags and card API image URLs
    const { data: lotsData } = await supabase
      .from("inventory_lots")
      .select("id, use_api_image, variation, card_id, cards!inner(api_image_url)")
      .in("id", lotIds);

    type LotMetadata = {
      use_api_image: boolean;
      api_image_url: string | null;
      variation: string;
    };
    const lotMetadataMap = new Map<string, LotMetadata>();
    (lotsData || []).forEach((lot: LotWithCardRow) => {
      const cards = Array.isArray(lot.cards) ? lot.cards[0] : lot.cards;
      lotMetadataMap.set(lot.id, {
        use_api_image: lot.use_api_image || false,
        api_image_url: cards?.api_image_url || null,
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
    (photosData || []).forEach((photo: PhotoRow) => {
      if (!photoKindsMap.has(photo.lot_id)) {
        photoKindsMap.set(photo.lot_id, new Set());
      }
      photoKindsMap.get(photo.lot_id)!.add(photo.kind);
    });

    // Latest market snapshots per card (prefer most recent regardless of source; pricing step picks provider)
    const snapshotsMap = new Map<string, EnrichedSnapshot>();
    if (cardIds.length > 0) {
      const { data: snaps } = await supabase
        .from("market_snapshots")
        .select("card_id, source, price_pence, captured_at, raw")
        .in("card_id", cardIds)
        .order("captured_at", { ascending: false });

      (snaps || []).forEach((s: MarketSnapshotRow) => {
        if (!snapshotsMap.has(s.card_id)) {
          snapshotsMap.set(s.card_id, {
            card_id: s.card_id,
            price_pence: s.price_pence,
            source: s.source,
            captured_at: s.captured_at,
            raw: s.raw,
          });
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
              const json = (await res.json()) as {
                chosen?: { price_pence?: number; source?: string };
                captured_at?: string;
                [key: string]: unknown;
              };
              if (res.ok && json?.chosen?.price_pence != null) {
                snapshotsMap.set(cid, {
                  card_id: cid,
                  price_pence: json.chosen.price_pence,
                  source: json.chosen.source || "unknown",
                  captured_at: json.captured_at || new Date().toISOString(),
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
    const enrichedData = (data || []).map((lot: VebayInboxLotRow) => {
      const metadata: LotMetadata = lotMetadataMap.get(lot.lot_id) || {
        use_api_image: false,
        api_image_url: null,
        variation: "standard",
      };
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
  } catch (error: unknown) {
    return handleApiError(req, error, { operation: "get_inbox_lots" });
  }
}
