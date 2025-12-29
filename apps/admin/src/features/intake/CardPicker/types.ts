import type { TcgdxSet, TcgdxCard } from "@/lib/tcgdx/types";
import { CONDITIONS, type Condition } from "../types";

export type { Condition, TcgdxSet, TcgdxCard };
export { CONDITIONS };

export const CONDITION_LABELS: Record<Condition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

