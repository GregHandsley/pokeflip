export const CARD_VARIATIONS = [
  "standard",
  "holo",
  "reverse_holo",
  "first_edition",
  "master_ball",
  "stamped",
  "promo",
  "shadowless",
  "non_holo",
] as const;

export type CardVariation = (typeof CARD_VARIATIONS)[number];

export const variationLabel = (v?: string | null) => {
  switch (v) {
    case "holo":
      return "Holo";
    case "reverse_holo":
      return "Reverse Holo";
    case "first_edition":
      return "First Edition";
    case "master_ball":
      return "Master Ball";
    case "stamped":
      return "Stamped";
    case "promo":
      return "Promo";
    case "shadowless":
      return "Shadowless";
    case "non_holo":
      return "Non-Holo";
    default:
      return "Standard";
  }
};

