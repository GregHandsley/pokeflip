"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CardPicker } from "@/features/intake/CardPicker";
import { DraftCart } from "@/features/intake/DraftCart";
import { insertDraftLine } from "@/features/intake/intakeInsert";
import type { Condition } from "@/features/intake/types";

export default function IntakeWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const acquisitionId = id;

  const [locale, setLocale] = useState("en");
  const [lastCondition, setLastCondition] = useState<Condition>("LP");
  const [defaultForSale, setDefaultForSale] = useState(true);
  const [defaultListPrice, setDefaultListPrice] = useState("0.99");
  const [toast, setToast] = useState<string | null>(null);
  const [cartKey, setCartKey] = useState(0); // Force cart refresh

  const onPickCard = async ({ setId, cardId, locale: cardLocale }: { setId: string; cardId: string; locale: string }) => {
    setToast(null);
    const { error } = await insertDraftLine({
      acquisitionId,
      setId,
      cardId,
      locale,
      defaults: {
        condition: lastCondition,
        forSale: defaultForSale,
        listPricePounds: defaultListPrice
      }
    });

    if (error) {
      setToast(error.message);
    } else {
      setToast("Added to draft cart");
      setCartKey(k => k + 1); // Trigger cart refresh
      // Don't close modal - allow adding multiple cards
    }
  };

  return (
    <main className="h-screen flex flex-col -m-6">
      <div className="flex items-center justify-between flex-shrink-0 mb-4 px-6 pt-6">
        <div>
          <h1 className="text-2xl font-semibold">Intake Workspace</h1>
          <p className="mt-1 text-black/60">
            Browse cards on the left, manage your cart on the right.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a className="text-sm underline" href="/admin/acquisitions">Back to acquisitions</a>
          <a className="text-sm underline" href="/admin/inventory">Inventory totals</a>
        </div>
      </div>

      {/* Defaults / speed controls */}
      <div className="rounded-2xl border border-black/10 bg-white p-5 flex-shrink-0 mb-4 mx-6">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm">
            Default condition
            <select
              className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5"
              value={lastCondition}
              onChange={(e) => setLastCondition(e.target.value as Condition)}
            >
              {["NM","LP","MP","HP","DMG"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>

          <label className="text-sm flex items-end gap-2 pb-2">
            <input 
              type="checkbox" 
              checked={defaultForSale} 
              onChange={(e) => setDefaultForSale(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Default for sale</span>
          </label>

          <label className="text-sm">
            Default list price (£)
            <input
              className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 disabled:opacity-50"
              value={defaultListPrice}
              onChange={(e) => setDefaultListPrice(e.target.value)}
              inputMode="decimal"
              disabled={!defaultForSale}
            />
          </label>

          <div className="text-sm text-black/60 flex items-center">
            {toast ? (
              <span className={`font-medium ${toast.includes("error") || toast.includes("violates") ? "text-red-600" : "text-green-600"}`}>
                {toast}
              </span>
            ) : (
              <span>Click cards to add them to your cart.</span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-side layout */}
      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0 px-6 pb-6">
        <CardPicker 
          onPickCard={onPickCard} 
          locale={locale}
          onLocaleChange={setLocale}
        />

        <DraftCart
          key={cartKey}
          acquisitionId={acquisitionId}
          onCommitted={() => setToast("Committed. Inventory totals updated.")}
        />
      </div>
    </main>
  );
}
