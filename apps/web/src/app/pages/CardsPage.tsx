import { useEffect, useState } from "react";
import { fetchCards, fetchCard, type CardListItem } from "@/lib/api";
import CardTile from "@/components/cards/CardTile";
import Lightbox from "@/components/media/LightBox";

export function CardsPage() {
  const [items, setItems] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{open: boolean; f?: any; b?: any}>({open:false});

  useEffect(() => {
    (async () => {
      try { setItems(await fetchCards()); }
      catch (e: any) { setErr(e?.message || String(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  async function copyField(sku: string, kind: "title" | "description") {
    setBusy(sku + ":" + kind);
    try {
      const data = await fetchCard(sku);
      const text = kind === "title" ? data.title : data.description;
      await navigator.clipboard.writeText(text);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-[rgb(var(--danger))]">{err}</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Cards</h1>

      {items.length === 0 ? (
        <div className="text-sm text-[rgb(var(--muted-ink))]">No cards yet.</div>
      ) : (
        <ul className="grid gap-6
                       [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {items.map((c) => (
            <CardTile
              key={c.sku}
              c={c}
              busy={busy}
              onOpenViewer={(card) => setViewer({
                open: true,
                f: card.thumbs.front?.zoom ?? null,
                b: card.thumbs.back?.zoom ?? null,
              })}
              onCopyTitle={(sku) => copyField(sku, "title")}
              onCopyDesc={(sku) => copyField(sku, "description")}
            />
          ))}
        </ul>
      )}

      <Lightbox
        open={viewer.open}
        onClose={() => setViewer({open:false})}
        front={viewer.f || undefined}
        back={viewer.b || undefined}
      />
    </div>
  );
}

export default CardsPage;