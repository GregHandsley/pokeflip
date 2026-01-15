import { supabaseBrowser } from "@/lib/supabase/browser";
import { logger } from "@/lib/logger";
import type { PurchaseLot as Lot } from "@/components/acquisitions/types";
import type { InboxLot } from "@/components/inbox/sales-flow/types";

type CardWithSet = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  api_image_url: string | null;
  sets: Array<{ id: string; name: string }> | null;
};

type PhotoQueryResult = {
  kind: string;
};

export async function convertLotToInboxLot(lot: Lot): Promise<InboxLot | null> {
  const supabase = supabaseBrowser();
  try {
    // Fetch card data with set information
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(
        `
        id,
        number,
        name,
        rarity,
        api_image_url,
        set_id,
        sets (
          id,
          name
        )
      `
      )
      .eq("id", lot.card_id)
      .single();

    if (cardError || !card) {
      logger.error("Error fetching card for InboxLot conversion", cardError, undefined, {
        cardId: lot.card_id,
      });
      return null;
    }

    const typedCard = card as CardWithSet;
    const set = typedCard.sets && typedCard.sets.length > 0 ? typedCard.sets[0] : null;

    // Get photos for this lot
    const { data: photos } = await supabase.from("lot_photos").select("kind").eq("lot_id", lot.id);

    const photoKinds = new Set(((photos as PhotoQueryResult[]) || []).map((p) => p.kind));
    const hasFrontPhoto = photoKinds.has("front");
    const hasBackPhoto = photoKinds.has("back");
    const hasRequiredPhotos = hasFrontPhoto && hasBackPhoto;

    // Get API image URL from card
    const apiImageUrl = typedCard.api_image_url || null;

    const inboxLot: InboxLot = {
      lot_id: lot.id,
      card_id: lot.card_id,
      card_number: typedCard.number || "",
      card_name: typedCard.name || "",
      set_name: set?.name || "",
      rarity: typedCard.rarity || null,
      condition: lot.condition,
      variation: lot.variation || "standard",
      status: lot.status,
      for_sale: lot.for_sale,
      list_price_pence: lot.list_price_pence,
      quantity: lot.quantity,
      available_qty: lot.available_qty,
      photo_count: lot.photo_count,
      use_api_image: lot.use_api_image || false,
      api_image_url: apiImageUrl,
      has_front_photo: hasFrontPhoto,
      has_back_photo: hasBackPhoto,
      has_required_photos: hasRequiredPhotos,
    };

    return inboxLot;
  } catch (e) {
    logger.error("Failed to convert lot to InboxLot", e, undefined, {
      lotId: lot.id,
      cardId: lot.card_id,
    });
    return null;
  }
}
