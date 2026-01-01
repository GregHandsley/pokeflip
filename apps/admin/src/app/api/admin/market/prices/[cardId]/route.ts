import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type PriceResult = {
  ok: boolean;
  captured_at: string;
  chosen?: {
    price_pence: number;
    price_gbp: number;
    source: string;
    basis: string;
    above_floor: boolean;
    floor_gbp: number;
  };
  cardmarket?: {
    unit: string;
    updated?: string;
    raw: any;
    gbp?: {
      trend?: number;
      avg?: number;
      avg7?: number;
      avg30?: number;
      low?: number;
      trend_holo?: number;
      avg_holo?: number;
      avg7_holo?: number;
      avg30_holo?: number;
      low_holo?: number;
      fx: number;
    };
  };
  tcgplayer?: {
    unit: string;
    updated?: string;
    raw: any;
    gbp?: {
      normal?: {
        market?: number;
        mid?: number;
        low?: number;
        high?: number;
      };
      reverse_holofoil?: {
        market?: number;
        mid?: number;
        low?: number;
        high?: number;
      };
      holofoil?: {
        market?: number;
        mid?: number;
        low?: number;
        high?: number;
      };
      fx: number;
    };
  };
};

const TCGDEX_API = "https://api.tcgdex.net/v2/en/cards";
const FX_API = "https://api.exchangerate.host/convert";
const FLOOR_GBP = Number(process.env.PRICE_FLOOR_GBP || "0.99");

async function fetchFx(from: "EUR" | "USD", to: "GBP"): Promise<number> {
  try {
    const res = await fetch(`${FX_API}?from=${from}&to=${to}`);
    if (!res.ok) throw new Error("fx fetch failed");
    const json = await res.json();
    const rate = Number(json?.result);
    return Number.isFinite(rate) && rate > 0 ? rate : from === "EUR" ? 0.85 : 0.78;
  } catch (e) {
    console.warn(`FX fetch failed (${from}->${to}), using fallback`, e);
    return from === "EUR" ? 0.85 : 0.78;
  }
}

function pickCardmarketEuro(pricing: any): number | null {
  if (!pricing?.cardmarket) return null;
  const cm = pricing.cardmarket;
  const candidates = [
    cm.trend,
    cm.avg,
    cm.avg7,
    cm.avg30,
    cm.low,
    cm.avg1,
    cm["avg-holo"],
    cm["avg7-holo"],
    cm["avg30-holo"],
    cm["trend-holo"],
  ].filter((n) => typeof n === "number" && Number.isFinite(n));
  return candidates.length ? Number(candidates[0]) : null;
}

function pickTcgplayerUsd(pricing: any): number | null {
  if (!pricing?.tcgplayer) return null;
  const tp = pricing.tcgplayer;
  const variants = Object.values(tp).filter((v) => v && typeof v === "object");
  for (const v of variants as any[]) {
    const val = v.marketPrice ?? v.midPrice ?? v.lowPrice ?? v.highPrice ?? v.directLowPrice;
    if (typeof val === "number" && Number.isFinite(val)) return Number(val);
  }
  return null;
}

function convertCmToGbp(cm: any, fx: number) {
  const conv = (v: any) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v * fx * 100)) : undefined);
  return {
    trend: conv(cm?.trend),
    avg: conv(cm?.avg),
    avg7: conv(cm?.avg7),
    avg30: conv(cm?.avg30),
    low: conv(cm?.low),
    trend_holo: conv(cm?.["trend-holo"]),
    avg_holo: conv(cm?.["avg-holo"]),
    avg7_holo: conv(cm?.["avg7-holo"]),
    avg30_holo: conv(cm?.["avg30-holo"]),
    low_holo: conv(cm?.["low-holo"]),
  };
}

function convertTpToGbp(tp: any, fx: number) {
  const conv = (v: any) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v * fx * 100)) : undefined);
  const shape = (v: any) =>
    v
      ? {
          market: conv(v.marketPrice ?? v.market),
          mid: conv(v.midPrice ?? v.mid),
          low: conv(v.lowPrice ?? v.low),
          high: conv(v.highPrice ?? v.high),
        }
      : undefined;
  return {
    normal: shape(tp?.normal),
    reverse_holofoil: shape(tp?.["reverse-holofoil"] ?? tp?.reverse),
    holofoil: shape(tp?.holofoil ?? tp?.holo),
    fx,
  };
}

function chooseForCondition(
  condition: string | null,
  variation: string | null,
  cmGbp: ReturnType<typeof convertCmToGbp> | undefined,
  tpGbp: ReturnType<typeof convertTpToGbp> | undefined
) {
  const cond = (condition || "").toUpperCase();
  const isHolo = variation?.includes("holo");
  // prefer Cardmarket trend/avg; fallback tcgplayer market/mid
  if (cmGbp) {
    if (isHolo) {
      const val = cmGbp.trend_holo ?? cmGbp.avg_holo ?? cmGbp.avg30_holo ?? cmGbp.avg7_holo ?? cmGbp.low_holo;
      if (val != null) return { price_pence: val, source: "tcgdex-cardmarket", basis: "cardmarket holo trend/avg" };
    }
    const val = cmGbp.trend ?? cmGbp.avg ?? cmGbp.avg30 ?? cmGbp.avg7 ?? cmGbp.low;
    if (val != null) return { price_pence: val, source: "tcgdex-cardmarket", basis: "cardmarket trend/avg" };
  }
  if (tpGbp) {
    const variant = isHolo ? tpGbp.reverse_holofoil ?? tpGbp.holofoil : tpGbp.normal ?? tpGbp.holofoil;
    if (variant) {
      const val = variant.market ?? variant.mid ?? variant.low ?? variant.high;
      if (val != null) return { price_pence: val, source: "tcgdex-tcgplayer", basis: isHolo ? "tcgplayer holo/reverse market/mid" : "tcgplayer normal market/mid" };
    }
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const supabase = supabaseServer();

    // ensure card exists for FK safety
    const { data: card } = await supabase
      .from("cards")
      .select("id")
      .eq("id", cardId)
      .maybeSingle();

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const tcgdexRes = await fetch(`${TCGDEX_API}/${encodeURIComponent(cardId)}`);
    if (!tcgdexRes.ok) {
      throw new Error(`TCGdex fetch failed (${tcgdexRes.status})`);
    }
    const tcgdexJson = await tcgdexRes.json();
    const pricing = tcgdexJson?.pricing;

    const euro = pickCardmarketEuro(pricing);
    const usd = pickTcgplayerUsd(pricing);

    const [fxEurGbp, fxUsdGbp] = await Promise.all([
      euro != null ? fetchFx("EUR", "GBP") : Promise.resolve(0),
      usd != null ? fetchFx("USD", "GBP") : Promise.resolve(0),
    ]);

    const cmGbp = pricing?.cardmarket && euro != null ? convertCmToGbp(pricing.cardmarket, fxEurGbp) : undefined;
    const tpGbp = pricing?.tcgplayer && usd != null ? convertTpToGbp(pricing.tcgplayer, fxUsdGbp) : undefined;

    const chosen = chooseForCondition(
      (tcgdexJson?.condition as string) || null, // may be absent
      null, // variation not known here; caller can supply
      cmGbp,
      tpGbp
    );

    const aboveFloor = chosen ? chosen.price_pence / 100 > FLOOR_GBP : false;

    if (chosen) {
      await supabase.from("market_snapshots").insert({
        card_id: cardId,
        source: chosen.source,
        price_pence: chosen.price_pence,
        currency: "GBP",
        raw: { pricing },
      });
    }

    const result: PriceResult = {
      ok: true,
      captured_at: new Date().toISOString(),
      chosen: chosen
        ? {
            price_pence: chosen.price_pence,
            price_gbp: chosen.price_pence / 100,
            source: chosen.source,
            basis: chosen.basis,
            above_floor: aboveFloor,
            floor_gbp: FLOOR_GBP,
          }
        : undefined,
      cardmarket: pricing?.cardmarket
        ? {
            unit: "EUR",
            updated: pricing.cardmarket.updated,
            raw: pricing.cardmarket,
            gbp: cmGbp ? { ...cmGbp, fx: fxEurGbp } : undefined,
          }
        : undefined,
      tcgplayer: pricing?.tcgplayer
        ? {
            unit: "USD",
            updated: pricing.tcgplayer.updated,
            raw: pricing.tcgplayer,
            gbp: tpGbp,
          }
        : undefined,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("price fetch failed", e);
    return NextResponse.json(
      { error: e?.message || "Failed to fetch price" },
      { status: 500 }
    );
  }
}

