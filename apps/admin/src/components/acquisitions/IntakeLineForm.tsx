"use client";

import { FormEvent, useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { poundsToPence } from "@pokeflip/shared";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

interface IntakeLineFormProps {
  acquisitionId: string;
  onLineAdded: () => void;
}

export default function IntakeLineForm({ acquisitionId, onLineAdded }: IntakeLineFormProps) {
  const supabase = supabaseBrowser();
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);
  const [cards, setCards] = useState<{ id: string; name: string; number: string; api_image_url: string | null }[]>([]);
  const [setId, setSetId] = useState("");
  const [cardId, setCardId] = useState("");
  const [condition, setCondition] = useState("LP");
  const [qty, setQty] = useState(1);
  const [forSale, setForSale] = useState(true);
  const [listPrice, setListPrice] = useState("0.99");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conditionOptions = [
    { value: "NM", label: "NM" },
    { value: "LP", label: "LP" },
    { value: "MP", label: "MP" },
    { value: "HP", label: "HP" },
    { value: "DMG", label: "DMG" },
  ];

  const selectedCard = useMemo(() => cards.find((c) => c.id === cardId), [cards, cardId]);

  useEffect(() => {
    const loadSets = async () => {
      const { data, error } = await supabase
        .from("sets")
        .select("id, name")
        .order("release_date", { ascending: false })
        .limit(5000);
      if (error) setError(error.message);
      else setSets((data ?? []) as { id: string; name: string }[]);
    };
    void loadSets();
  }, []);

  useEffect(() => {
    if (setId) {
      const loadCards = async () => {
        const { data, error } = await supabase
          .from("cards")
          .select("id, name, number, api_image_url")
          .eq("set_id", setId)
          .order("number", { ascending: true })
          .limit(5000);
        if (error) setError(error.message);
        else setCards((data ?? []) as { id: string; name: string; number: string; api_image_url: string | null }[]);
      };
      void loadCards();
    } else {
      setCards([]);
      setCardId("");
    }
  }, [setId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!setId || !cardId) {
      setError("Select a set and a card first.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("intake_lines").insert({
      acquisition_id: acquisitionId,
      set_id: setId,
      card_id: cardId,
      condition,
      quantity: qty,
      for_sale: forSale,
      list_price_pence: forSale ? poundsToPence(listPrice) : null,
      status: "draft",
    } as any);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setQty(1);
      setListPrice("0.99");
      onLineAdded();
      setLoading(false);
    }
  };

  const setOptions = sets.map((s) => ({ value: s.id, label: s.name }));
  const cardOptions = cards.map((c) => ({ value: c.id, label: `${c.number} — ${c.name}` }));

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Set"
          value={setId}
          onChange={(e) => {
            setSetId(e.target.value);
            setCardId("");
          }}
          options={[{ value: "", label: "Select…" }, ...setOptions]}
        />

        <Select
          label="Card"
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          disabled={!setId}
          options={[{ value: "", label: "Select…" }, ...cardOptions]}
        />
      </div>

      {selectedCard?.api_image_url && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <img
            src={selectedCard.api_image_url}
            alt={`${selectedCard.name} preview`}
            className="h-20 w-auto rounded-lg border border-gray-200"
          />
          <div className="text-sm text-gray-600">
            Using API image for reference (photos optional later).
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

