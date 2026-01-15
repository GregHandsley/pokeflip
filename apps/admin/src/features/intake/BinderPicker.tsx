"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { BinderLayout, layoutToGrid } from "./types";

type SetRow = { id: string; name: string; release_date: string | null };
type CardRow = {
  id: string;
  set_id: string;
  number: string;
  name: string;
  api_image_url: string | null;
};

type Props = {
  selectedSetId: string;
  onChangeSetId: (setId: string) => void;
  onPickCard: (args: { setId: string; cardId: string }) => void;
};

export function BinderPicker({ selectedSetId, onChangeSetId, onPickCard }: Props) {
  const supabase = supabaseBrowser();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [layout, setLayout] = useState<BinderLayout>(9);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");

  const grid = layoutToGrid(layout);

  useEffect(() => {
    let cancelled = false;
    const loadSets = async () => {
      const { data } = await supabase
        .from("sets")
        .select("id, name, release_date")
        .order("release_date", { ascending: false })
        .limit(5000);
      if (!cancelled) {
        setSets((data ?? []) as SetRow[]);
      }
    };
    loadSets();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadCards = async () => {
      if (!selectedSetId) {
        // Clear state asynchronously when no set is selected
        if (!cancelled) {
          setCards([]);
          setPage(0);
        }
        return;
      }
      const { data } = await supabase
        .from("cards")
        .select("id, set_id, number, name, api_image_url")
        .eq("set_id", selectedSetId)
        .order("number", { ascending: true })
        .limit(5000);
      if (!cancelled) {
        setCards((data ?? []) as CardRow[]);
        setPage(0);
      }
    };
    void loadCards();
    return () => {
      cancelled = true;
    };
  }, [supabase, selectedSetId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.number.toLowerCase().includes(needle)
    );
  }, [cards, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / grid.perPage));
  const pageCards = filtered.slice(page * grid.perPage, page * grid.perPage + grid.perPage);

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full">
          <h2 className="text-lg font-semibold">Binder</h2>
          <p className="mt-1 text-sm text-black/60">
            Choose a set, then click cards to add them to your draft cart.
          </p>

          <label className="mt-3 block text-sm">
            Set
            <select
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
              value={selectedSetId}
              onChange={(e) => onChangeSetId(e.target.value)}
            >
              <option value="">Select…</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.release_date ? ` (${s.release_date})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[6, 9, 12].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setLayout(v as BinderLayout);
                  setPage(0);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm border border-black/10 ${
                  layout === v ? "bg-black text-white" : "bg-white hover:bg-black/5"
                }`}
                type="button"
              >
                {v} pockets
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
                disabled={page <= 0}
                aria-label="Previous page"
              >
                Prev
              </button>
              <div className="text-sm text-black/60">
                {totalPages === 0 ? "0/0" : `${page + 1}/${totalPages}`}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
                disabled={page >= totalPages - 1}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>

          <input
            className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2"
            placeholder="Search within set (name or number)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            disabled={!selectedSetId}
          />
        </div>
      </div>

      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}
      >
        {pageCards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPickCard({ setId: c.set_id, cardId: c.id })}
            className="group rounded-xl border border-black/10 bg-white p-2 text-left hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/80"
          >
            <div className="aspect-[2.5/3.5] w-full overflow-hidden rounded-lg border border-black/10 bg-black/5 flex items-center justify-center relative">
              {c.api_image_url ? (
                <Image
                  src={`${c.api_image_url}/low.webp`}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="text-xs text-black/50 p-2">No image</div>
              )}
            </div>
            <div className="mt-2 text-sm font-medium">{c.number}</div>
            <div className="text-xs text-black/60 line-clamp-1">{c.name}</div>
          </button>
        ))}

        {!selectedSetId && (
          <div className="col-span-full text-sm text-black/60">Select a set to start.</div>
        )}

        {selectedSetId && filtered.length === 0 && (
          <div className="col-span-full text-sm text-black/60">
            No cards cached for this set yet. Go to Catalog Sync and sync cards.
          </div>
        )}
      </div>
    </section>
  );
}
