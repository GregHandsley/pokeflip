import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchCard } from "@/lib/api";
import AspectThumb from "@/components/media/AspectThumb";
import Lightbox from "@/components/media/LightBox";

export default function CardDetailPage() {
  const { sku } = useParams();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{open:boolean; f?: any; b?: any}>({open:false});

  useEffect(() => {
    (async () => {
      try {
        if (sku) setCard(await fetchCard(sku));
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [sku]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !card) return <div className="p-6 text-[rgb(var(--danger))]">Not found</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{card.sku}</h1>
        <Link to="/cards" className="text-sm underline">Back to Cards</Link>
      </div>

      <div className="flex gap-6">
        <div className="space-y-1">
          <div className="text-sm text-[rgb(var(--muted-ink))]">Front</div>
          <div onClick={() => setViewer({open:true, f: card.thumbs.front?.zoom, b: card.thumbs.back?.zoom})}>
            <AspectThumb srcs={card.thumbs.front?.detail ?? null} alt="front" className="w-56 cursor-zoom-in" eager />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-[rgb(var(--muted-ink))]">Back</div>
          <div onClick={() => setViewer({open:true, f: card.thumbs.front?.zoom, b: card.thumbs.back?.zoom})}>
            <AspectThumb srcs={card.thumbs.back?.detail ?? null} alt="back" className="w-56 cursor-zoom-in" eager />
          </div>
        </div>
        <div className="text-sm text-[rgb(var(--muted-ink))] space-y-1">
          <div><b>Name:</b> {card.name}</div>
          <div><b>Set:</b> {card.set}</div>
          <div><b>Number:</b> {card.number}</div>
          <div><b>Language:</b> {card.language}</div>
          <div><b>Condition:</b> {card.condition}</div>
          <div><b>Variant:</b> {card.holo ? "Holo" : "Normal"}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Title</h2>
          <button
            onClick={() => copy(card.title)}
            className="px-3 py-1.5 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-alt))]"
          >
            Copy
          </button>
        </div>
        <input
          readOnly
          value={card.title}
          className="w-full border rounded px-2 py-2 font-medium"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Description</h2>
          <button
            onClick={() => copy(card.description)}
            className="px-3 py-1.5 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-alt))]"
          >
            Copy
          </button>
        </div>
        <textarea
          readOnly
          rows={10}
          value={card.description}
          className="w-full border rounded px-3 py-2 leading-6"
        />
      </div>

      <Lightbox
        open={viewer.open}
        onClose={() => setViewer({open:false})}
        front={viewer.f}
        back={viewer.b}
      />
    </div>
  );
}