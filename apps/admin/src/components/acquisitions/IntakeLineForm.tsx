"use client";

import { FormEvent, useState, useEffect, useMemo } from "react";
import { poundsToPence } from "@pokeflip/shared";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import type { TcgSet, TcgCard } from "@/lib/tcgdx/types";
import { CARD_CONDITIONS } from "@/lib/tcgdx/constants";
import { useCatalogSets } from "./hooks/useCatalogSets";
import { useTcgdxCards } from "./hooks/useTcgdxCards";

interface IntakeLineFormProps {
  acquisitionId: string;
  onLineAdded: () => void;
}

export default function IntakeLineForm({ acquisitionId, onLineAdded }: IntakeLineFormProps) {
  const [setId, setSetId] = useState("");
  const [cardId, setCardId] = useState("");
  const [condition, setCondition] = useState("LP");
  const [qty, setQty] = useState(1);
  const [forSale, setForSale] = useState(true);
  const [listPrice, setListPrice] = useState("0.99");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use hooks for data fetching
  const { sets, loading: loadingSets, error: setsError } = useCatalogSets();
  const { cards, loading: loadingCards, error: cardsError } = useTcgdxCards(
    setId || null,
    "en"
  );

  const conditionOptions = CARD_CONDITIONS.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const selectedCard = useMemo(() => cards.find((c) => c.id === cardId), [cards, cardId]);

  // Handle errors from hooks
  useEffect(() => {
    if (setsError) {
      setError(setsError);
    }
  }, [setsError]);

  // Reset card selection when set changes
  useEffect(() => {
    if (setId) {
      setCardId("");
    }
  }, [setId]);

  // Handle cards error
  useEffect(() => {
    if (cardsError) {
      setError(cardsError);
    }
  }, [cardsError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!setId || !cardId) {
      setError("Select a set and a card first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/intake/add-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acquisition_id: acquisitionId,
          set_id: setId,
          card_id: cardId,
          condition,
          quantity: qty,
          for_sale: forSale,
          list_price_pence: forSale ? poundsToPence(listPrice) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add intake line");

      setQty(1);
      setListPrice("0.99");
      onLineAdded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const setOptions = sets.map((s) => ({
    value: s.id,
    label: `${s.name}${s.releaseDate ? ` (${s.releaseDate})` : ""}`,
  }));

  const cardOptions = cards.map((c) => ({
    value: c.id,
    label: `${c.number || "?"} — ${c.name}`,
  }));

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Select
            label="Set"
            value={setId}
            onChange={(e) => {
              setSetId(e.target.value);
              setCardId("");
            }}
            disabled={loadingSets}
            options={[
              { value: "", label: loadingSets ? "Loading sets..." : "Select…" },
              ...setOptions,
            ]}
          />
        </div>

        <div>
          <Select
            label="Card"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            disabled={!setId || loadingCards}
            options={[
              { value: "", label: loadingCards ? "Loading cards..." : "Select…" },
              ...cardOptions,
            ]}
          />
        </div>
      </div>

      {selectedCard?.image && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <img
            src={`${selectedCard.image}/high.webp`}
            alt={`${selectedCard.name} preview`}
            className="h-20 w-auto rounded-lg border border-gray-200"
          />
          <div className="text-sm text-gray-600">
            Card preview from TCGdex API
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Select
          label="Condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          options={conditionOptions}
        />

        <Input
          label="Qty"
          type="number"
          min={1}
          value={qty.toString()}
          onChange={(e) => setQty(Number(e.target.value))}
        />

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={forSale}
              onChange={(e) => setForSale(e.target.checked)}
              className="rounded"
            />
            For sale
          </label>
        </div>

        <Input
          label="List price (£)"
          type="text"
          value={listPrice}
          onChange={(e) => setListPrice(e.target.value)}
          disabled={!forSale}
          inputMode="decimal"
        />
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add draft line"}
      </Button>
    </form>
  );
}
