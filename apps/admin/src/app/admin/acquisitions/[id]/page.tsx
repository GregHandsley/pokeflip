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

  const [defaultForSale, setDefaultForSale] = useState(true);
  const [defaultListPrice, setDefaultListPrice] = useState("0.99");
  const [toast, setToast] = useState<string | null>(null);
  const [cartKey, setCartKey] = useState(0); // Force cart refresh
  const [newlyAddedSetId, setNewlyAddedSetId] = useState<string | null>(null);
  const [newlyAddedCardId, setNewlyAddedCardId] = useState<string | null>(null);

  const onPickCard = async ({ setId, cardId, locale: cardLocale, condition, quantity, variation }: { setId: string; cardId: string; locale: string; condition: Condition; quantity: number; variation: string }) => {
    setToast(null);
    const { error } = await insertDraftLine({
      acquisitionId,
      setId,
      cardId,
      locale: "en", // Always use English
      quantity,
      defaults: {
        condition,
        variation,
        forSale: defaultForSale,
        listPricePounds: defaultListPrice
      }
    });

    if (error) {
      setToast(error.message);
    } else {
      setToast("Added to draft cart");
      setNewlyAddedSetId(setId); // Track which set was just added to
      setNewlyAddedCardId(cardId); // Track which card was just added
      setCartKey(k => k + 1); // Trigger cart refresh
      // Clear the newlyAdded values after a short delay so they don't keep expanding
      setTimeout(() => {
        setNewlyAddedSetId(null);
        setNewlyAddedCardId(null);
      }, 100);
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
          <a className="text-sm underline" href="/admin/acquisitions">Back to purchases</a>
          <a className="text-sm underline" href="/admin/inventory">Inventory totals</a>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="mx-6 mb-4 flex-shrink-0">
          <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
            toast.includes("error") || toast.includes("violates") 
              ? "bg-red-50 text-red-700 border border-red-200" 
              : "bg-green-50 text-green-700 border border-green-200"
          }`}>
            {toast}
          </div>
        </div>
      )}

      {/* Side-by-side layout */}
      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0 px-6 pb-6">
        <CardPicker 
          onPickCard={onPickCard}
        />

        <DraftCart
          key={cartKey}
          acquisitionId={acquisitionId}
          newlyAddedSetId={newlyAddedSetId}
          newlyAddedCardId={newlyAddedCardId}
          onCommitted={() => setToast("Committed. Inventory totals updated.")}
        />
      </div>
    </main>
  );
}
