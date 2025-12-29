"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import InventoryCard from "@/components/inventory/InventoryCard";

type Row = {
  card_id: string;
  set_id: string;
  number: string;
  name: string;
  rarity: string | null;
  api_image_url: string | null;
  qty_active: number | null;
  qty_listed: number | null;
  qty_sold: number | null;
  max_list_price_pence: number | null;
};

export default function InventoryTotalsPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("v_card_inventory_totals")
      .select("*")
      .order("set_id", { ascending: true })
      .order("number", { ascending: true })
      .limit(2000);

    if (!error) {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = rows.filter(
    (r) =>
      (r.name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (r.number ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Inventory Totals" />

      <div className="mb-6">
        <SearchInput
          placeholder="Search card name or number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-600">No results.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <InventoryCard
              key={r.card_id}
              card_id={r.card_id}
              number={r.number}
              name={r.name}
              api_image_url={r.api_image_url}
              qty_active={r.qty_active}
              qty_listed={r.qty_listed}
              qty_sold={r.qty_sold}
              max_list_price_pence={r.max_list_price_pence}
            />
          ))}
        </div>
      )}
    </div>
  );
}
