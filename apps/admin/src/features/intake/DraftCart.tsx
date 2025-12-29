"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { CONDITIONS, Condition } from "./types";
import { poundsToPence, penceToPounds } from "@pokeflip/shared";

type DraftLine = {
  id: string;
  card_id: string;
  set_id: string;
  condition: Condition;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  note: string | null;
  cards: { number: string; name: string; api_image_url: string | null } | null;
  sets: { name: string } | null;
};

type Props = {
  acquisitionId: string;
  onCommitted?: () => void;
};

export function DraftCart({ acquisitionId, onCommitted }: Props) {
  const supabase = supabaseBrowser();
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ url: string; name: string } | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string; x: number; y: number } | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("intake_lines")
      .select("id, card_id, set_id, condition, quantity, for_sale, list_price_pence, note, cards(number, name, api_image_url), sets(name)")
      .eq("acquisition_id", acquisitionId)
      .eq("status", "draft")
      .order("created_at", { ascending: true });

    if (error) setMsg(error.message);
    else setLines((data ?? []) as DraftLine[]);
  };

  useEffect(() => { void load(); }, [acquisitionId]);

  const updateLine = async (id: string, patch: Partial<DraftLine>) => {
    setMsg(null);
    const toDb: any = { ...patch };
    delete toDb.cards;

    const { error } = await supabase.from("intake_lines").update(toDb).eq("id", id);
    if (error) setMsg(error.message);
    else await load();
  };

  const removeLine = async (id: string) => {
    setMsg(null);
    const { error } = await supabase.from("intake_lines").delete().eq("id", id);
    if (error) setMsg(error.message);
    else await load();
  };

  const duplicateLine = async (line: DraftLine) => {
    setMsg(null);
    const toDb: any = {
      acquisition_id: acquisitionId,
      set_id: line.set_id,
      card_id: line.card_id,
      condition: line.condition,
      quantity: line.quantity,
      for_sale: line.for_sale,
      list_price_pence: line.list_price_pence,
      note: line.note,
      status: "draft",
    };

    const { error } = await supabase.from("intake_lines").insert(toDb);
    if (error) setMsg(error.message);
    else await load();
  };

  const commit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.rpc("commit_acquisition", { p_acquisition_id: acquisitionId });
      if (error) throw error;
      setMsg(data?.message ?? "Committed");
      await load();
      onCommitted?.();
    } catch (e: any) {
      setMsg(e.message ?? "Commit failed");
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

  // Sets are closed by default - user can expand them manually

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
            {Array.from(linesBySet.entries()).map(([setId, setLines]) => {
              const set = setLines[0]?.sets;
              const setTotalQty = setLines.reduce((sum, l) => sum + l.quantity, 0);
              const isExpanded = expandedSets.has(setId);

              const toggleSet = () => {
                const newSet = new Set(expandedSets);
                if (isExpanded) {
                  newSet.delete(setId);
                } else {
                  newSet.add(setId);
                }
                setExpandedSets(newSet);
              };

              return (
                <div key={setId} className="border border-black/10 rounded-lg overflow-hidden bg-white">
                  {/* Set header - accordion trigger */}
                  <button
                    type="button"
                    onClick={toggleSet}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-black/40">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                      <h3 className="font-semibold text-base">{set?.name || 'Unknown set'}</h3>
                    </div>
                    <span className="text-xs text-black/60">{setTotalQty} card{setTotalQty !== 1 ? 's' : ''}</span>
                  </button>

                  {/* Set content - accordion panel */}
                  {isExpanded && (
                    <div className="border-t border-black/10">

                  {/* Cardmarket-style table */}
                  <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
                      {/* Table header */}
                      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-black/5 border-b border-black/10 text-xs font-semibold text-black/70">
                        <div className="col-span-1"></div>
                        <div className="col-span-4">Card</div>
                        <div className="col-span-1">Cond</div>
                        <div className="col-span-1">Qty</div>
                        <div className="col-span-1">Sale</div>
                        <div className="col-span-2">Price</div>
                        <div className="col-span-1">Note</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Table rows */}
                      <div className="divide-y divide-black/10">
                        {setLines.map((l) => {
                          const baseNumber = l.cards?.number?.split('-')[0]?.trim();
                          const cardDisplay = baseNumber 
                            ? `#${baseNumber} ${l.cards.name}` 
                            : l.cards?.name || 'Unknown card';
                          const imageUrl = l.cards?.api_image_url ? `${l.cards.api_image_url}/high.webp` : null;

                          return (
                            <div key={l.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-black/5 transition-colors relative">
                              {/* Image hover button */}
                              <div className="col-span-1">
                                {imageUrl ? (
                                  <div
                                    className="relative"
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredImage({ 
                                        url: imageUrl, 
                                        name: cardDisplay,
                                        x: rect.right + 10,
                                        y: rect.top
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredImage(null)}
                                  >
                                    <button
                                      type="button"
                                      className="p-1.5 rounded hover:bg-black/10 transition-colors"
                                      title="Hover to view card image"
                                    >
                                      <svg className="w-4 h-4 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-7 h-7"></div>
                                )}
                              </div>

                            {/* Card name */}
                            <div className="col-span-4">
                              <div className="font-medium text-sm">{cardDisplay}</div>
                            </div>

                            {/* Condition */}
                            <div className="col-span-1">
                              <select
                                className="w-full rounded border border-black/10 px-2 py-1.5 text-xs bg-white"
                                value={l.condition}
                                onChange={(e) => updateLine(l.id, { condition: e.target.value as Condition })}
                              >
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-1">
                              <input
                                className="w-full rounded border border-black/10 px-2 py-1.5 text-xs"
                                type="number"
                                min={1}
                                value={l.quantity}
                                onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) })}
                              />
                            </div>

                            {/* For sale */}
                            <div className="col-span-1">
                              <input
                                type="checkbox"
                                checked={l.for_sale}
                                onChange={(e) =>
                                  updateLine(l.id, {
                                    for_sale: e.target.checked,
                                    list_price_pence: e.target.checked ? (l.list_price_pence ?? poundsToPence("0.99")) : null
                                  })
                                }
                                className="w-4 h-4"
                              />
                            </div>

                            {/* Price */}
                            <div className="col-span-2">
                              <input
                                className="w-full rounded border border-black/10 px-2 py-1.5 text-xs disabled:opacity-50"
                                disabled={!l.for_sale}
                                value={l.for_sale ? (l.list_price_pence != null ? penceToPounds(l.list_price_pence) : "") : ""}
                                onChange={(e) => updateLine(l.id, { list_price_pence: poundsToPence(e.target.value) })}
                                inputMode="decimal"
                                placeholder="0.00"
                              />
                            </div>

                            {/* Note */}
                            <div className="col-span-1">
                              <input
                                className="w-full rounded border border-black/10 px-2 py-1.5 text-xs"
                                value={l.note ?? ""}
                                onChange={(e) => updateLine(l.id, { note: e.target.value })}
                                placeholder="Note..."
                                title={l.note || "Add note"}
                              />
                            </div>

                            {/* Remove */}
                            <div className="col-span-1">
                              <button
                                type="button"
                                onClick={() => removeLine(l.id)}
                                className="w-full rounded border border-black/10 px-2 py-1.5 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                    </div>
                  )}
                </div>
              );
            })}
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
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${hoveredImage.x}px`,
            top: `${hoveredImage.y}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="bg-white rounded-lg shadow-2xl border-2 border-black/20 p-3 max-w-xs">
            <div className="text-xs font-semibold mb-2 text-black/80">{hoveredImage.name}</div>
            <img 
              src={hoveredImage.url} 
              alt={hoveredImage.name}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Image viewer modal (for click if needed) */}
      {imageViewer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageViewer(null)}
        >
          <div className="relative max-w-2xl w-full">
            <button
              onClick={() => setImageViewer(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl"
              aria-label="Close"
            >
              ×
            </button>
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">{imageViewer.name}</h3>
              <img 
                src={imageViewer.url} 
                alt={imageViewer.name}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

