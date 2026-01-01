"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { DraftLine } from "./DraftCart/types";
import { SetAccordion } from "./DraftCart/SetAccordion";
import { HoverImagePreview } from "./DraftCart/HoverImagePreview";
import { ImageViewerModal } from "./DraftCart/ImageViewerModal";

type Props = {
  acquisitionId: string;
  newlyAddedSetId?: string | null;
  newlyAddedCardId?: string | null;
  onCommitted?: () => void;
};

export function DraftCart({ acquisitionId, newlyAddedSetId, newlyAddedCardId, onCommitted }: Props) {
  const supabase = supabaseBrowser();
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ url: string; name: string } | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string; x: number; y: number } | null>(null);
  const [englishNames, setEnglishNames] = useState<Map<string, string>>(new Map());

  const load = async () => {
    const { data, error } = await supabase
      .from("intake_lines")
      .select("id, card_id, set_id, condition, variation, quantity, for_sale, list_price_pence, note, cards(number, name, api_image_url, api_payload), sets(name)")
      .eq("acquisition_id", acquisitionId)
      .eq("status", "draft")
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      return;
    }

    const loadedLines = (data ?? []) as DraftLine[];
    setLines(loadedLines);

    // Auto-expand set if a new card was just added to it
    if (newlyAddedSetId) {
      setExpandedSets(prev => new Set([...prev, newlyAddedSetId]));
    }

    // Auto-expand card accordion if a new card was just added and it has multiple entries
    if (newlyAddedSetId && newlyAddedCardId) {
      const cardGroupKey = `${newlyAddedSetId}-${newlyAddedCardId}`;
      // Check if this card has multiple lines or quantity > 1 (needs accordion)
      const cardLines = loadedLines.filter(l => l.set_id === newlyAddedSetId && l.card_id === newlyAddedCardId);
      const hasMultipleEntries = cardLines.length > 1 || cardLines.some(l => l.quantity > 1);
      if (hasMultipleEntries) {
        setExpandedCards(prev => new Set([...prev, cardGroupKey]));
      }
    }

    // Fetch English names for cards that appear to be in other languages
    const cardsNeedingEnglish = loadedLines.filter(line => {
      const name = line.cards?.name || "";
      return name && /[^\x00-\x7F]/.test(name);
    });

    if (cardsNeedingEnglish.length > 0) {
      const englishNameMap = new Map<string, string>();
      
      for (const line of cardsNeedingEnglish) {
        try {
          const { fetchCardById } = await import("@/lib/tcgdx/tcgdxClient");
          const englishCard = await fetchCardById(line.card_id, "en");
          
          if (englishCard?.name) {
            englishNameMap.set(line.card_id, englishCard.name);
          }
        } catch (e: any) {
          if (!e?.message?.includes("404")) {
            console.warn(`Failed to fetch English name for card ${line.card_id}:`, e);
          }
        }
      }
      
      setEnglishNames(englishNameMap);
    } else {
      setEnglishNames(new Map());
    }
  };

  useEffect(() => { void load(); }, [acquisitionId, newlyAddedSetId, newlyAddedCardId]);

  const updateLine = async (id: string, patch: Partial<DraftLine>) => {
    setMsg(null);
    const { cards, sets, ...toDb } = patch as any;
    const { error } = await (supabase.from("intake_lines") as any).update(toDb).eq("id", id);
    if (error) setMsg(error.message);
    else await load();
  };

  const removeLine = async (id: string) => {
    setMsg(null);
    const { error } = await supabase.from("intake_lines").delete().eq("id", id);
    if (error) setMsg(error.message);
    else await load();
  };

  const commit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.rpc("commit_acquisition", { p_acquisition_id: acquisitionId } as any);
      if (error) throw error;
      setMsg((data as any)?.message ?? "Committed");
      await load();
      onCommitted?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  const totalQty = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  // Group lines by set
  const linesBySet = useMemo(() => {
    const grouped = new Map<string, DraftLine[]>();
    lines.forEach(line => {
      const setId = line.set_id;
      if (!grouped.has(setId)) {
        grouped.set(setId, []);
      }
      grouped.get(setId)!.push(line);
    });
    return grouped;
  }, [lines]);

  const toggleSet = (setId: string) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };

  const toggleCard = (cardGroupKey: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardGroupKey)) {
        newSet.delete(cardGroupKey);
      } else {
        newSet.add(cardGroupKey);
      }
      return newSet;
    });
  };

  const handleHoverImage = (url: string, name: string, x: number, y: number) => {
    setHoveredImage({ url, name, x, y });
  };

  const handleLeaveImage = () => {
    setHoveredImage(null);
  };

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-semibold">Draft cart</h2>
          <p className="mt-1.5 text-sm text-black/60">
            Add cards, edit details, then commit to inventory.
          </p>
        </div>
        <div className="text-sm text-black/60 font-medium">
          Lines: {lines.length} • Qty: {totalQty}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 pr-2">
        {lines.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">🃏</div>
            <p className="text-sm text-black/60">No cards in cart yet</p>
            <p className="text-xs text-black/40 mt-1">Click cards on the left to add them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(linesBySet.entries()).map(([setId, setLines]) => (
              <SetAccordion
                key={setId}
                setId={setId}
                setLines={setLines}
                isExpanded={expandedSets.has(setId)}
                onToggle={() => toggleSet(setId)}
                expandedCards={expandedCards}
                onToggleCard={toggleCard}
                onUpdate={updateLine}
                onRemove={removeLine}
                onHoverImage={handleHoverImage}
                onLeaveImage={handleLeaveImage}
                englishNames={englishNames}
                acquisitionId={acquisitionId}
                supabase={supabase}
                setMsg={setMsg}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={commit}
          disabled={busy || lines.length === 0}
          className="rounded-lg bg-black text-white px-4 py-2 font-medium disabled:opacity-60"
        >
          Commit to inventory
        </button>

        {msg && <p className="text-sm text-black/70">{msg}</p>}
      </div>

      {/* Hover image preview */}
      {hoveredImage && (
        <HoverImagePreview
          url={hoveredImage.url}
          name={hoveredImage.name}
          x={hoveredImage.x}
          y={hoveredImage.y}
        />
      )}

      {/* Image viewer modal */}
      {imageViewer && (
        <ImageViewerModal
          url={imageViewer.url}
          name={imageViewer.name}
          onClose={() => setImageViewer(null)}
        />
      )}
    </section>
  );
}
