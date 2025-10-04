import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { stagePending } from "@/lib/api";

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const items = await fetch(`http://localhost:8000/pending`) // NOTE: we'll reuse pending list to keep backend small
          .then(r => r.json()).then(d => d.items as any[]);
        setItem(items.find(x => x.id === Number(id)));
      } catch (e: any) { setErr(String(e)); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const ocr = useMemo(() => {
    // Mock suggestions based on filename patterns
    const guess = (k: string | null) => {
      if (!k) return {};
      // naive guesses
      const m = /IMG_(\d+)/i.exec(k);
      return {
        name: "Unknown Card",
        set: "Base",
        number: m ? m[1] : "001",
      };
    };
    const g = guess(item?.key_front || null);
    return { ...g, language: "EN", condition: "NM", holo: false };
  }, [item]);

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (ocr && !form) setForm(ocr); }, [ocr, form]);

  async function submit() {
    if (!form) return;
    await stagePending(Number(id), form);
    navigate("/cards");
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !item) return <div className="p-6 text-[rgb(var(--danger))]">Not found</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Review & Stage</h1>
      <div className="flex gap-3">
        {item.front_url && <img src={item.front_url} alt="front" className="w-60 rounded border" />}
        {item.back_url && <img src={item.back_url} alt="back" className="w-60 rounded border" />}
      </div>

      <div className="grid gap-3 max-w-md">
        {[
          ["name","Name"],["set","Set"],["number","Number"],
          ["language","Language (EN/JP/..)"],["condition","Condition (NM/LP/..)"]
        ].map(([k,label])=>(
          <label key={k} className="text-sm">
            <div className="mb-1">{label}</div>
            <input
              className="w-full border rounded px-2 py-1"
              value={form?.[k] ?? ""}
              onChange={e => setForm((s:any)=>({...s,[k]:e.target.value}))}
            />
          </label>
        ))}
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={!!form?.holo} onChange={e=>setForm((s:any)=>({...s,holo:e.target.checked}))}/>
          Holo
        </label>
        <button onClick={submit} className="px-3 py-1.5 rounded bg-[rgb(var(--brand))] text-white hover:opacity-90">
          Stage to Cards
        </button>
      </div>
    </div>
  );
}