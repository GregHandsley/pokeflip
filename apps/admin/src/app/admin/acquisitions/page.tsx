"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { poundsToPence } from "@pokeflip/shared";

type Acquisition = {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  notes: string | null;
  status: "open" | "closed";
};

export default function AcquisitionsPage() {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<Acquisition[]>([]);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");

  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("packs");
  const [total, setTotal] = useState("0.00");
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const q = supabase
      .from("acquisitions")
      .select("id, source_name, source_type, purchase_total_pence, purchased_at, notes, status")
      .order("created_at", { ascending: false });

    const { data, error } =
      filter === "all" ? await q : await q.eq("status", filter);

    if (error) setMsg(error.message);
    else setRows((data ?? []) as Acquisition[]);
  };

  useEffect(() => { void load(); }, [filter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const { error } = await supabase.from("acquisitions").insert({
      source_name: sourceName,
      source_type: sourceType,
      purchase_total_pence: poundsToPence(total),
      purchased_at: new Date(purchasedAt + "T12:00:00Z").toISOString(),
      notes: notes.trim() ? notes.trim() : null,
      status: "open"
    });

    if (error) setMsg(error.message);
    else {
      setSourceName("");
      setTotal("0.00");
      setNotes("");
      setFilter("open");
      await load();
    }
  };

  const toggleStatus = async (id: string, next: "open" | "closed") => {
    setMsg(null);
    const { error } = await supabase.from("acquisitions").update({ status: next }).eq("id", id);
    if (error) setMsg(error.message);
    else await load();
  };

  const header = useMemo(() => {
    if (filter === "open") return "Open acquisitions";
    if (filter === "closed") return "Closed acquisitions";
    return "All acquisitions";
  }, [filter]);

  return (
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between">
    <div>
          <h1 className="text-2xl font-semibold">Acquisitions</h1>
          <p className="mt-1 text-black/60">Create a purchase batch, intake via binder, then commit.</p>
        </div>
        <a className="text-sm underline" href="/admin">Admin</a>
      </div>

      <div className="mt-5 flex gap-2">
        {(["open","closed","all"] as const).map(v => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-lg px-3 py-1.5 text-sm border border-black/10 ${
              filter === v ? "bg-black text-white" : "bg-white hover:bg-black/5"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <form onSubmit={create} className="mt-6 grid gap-3 max-w-2xl rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-lg font-semibold">New acquisition</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Source (seller/shop)
            <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
              value={sourceName} onChange={(e) => setSourceName(e.target.value)} required />
          </label>

          <label className="text-sm">
            Type
            <select className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
              value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              <option value="packs">Packs</option>
              <option value="collection">Collection</option>
              <option value="singles">Singles</option>
              <option value="trade">Trade</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Total cost (£)
            <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
              value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" />
          </label>

          <label className="text-sm">
            Purchase date
            <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
              type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
          </label>
        </div>

        <label className="text-sm">
          Notes
          <textarea className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 min-h-[72px]"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button className="rounded-lg bg-black text-white py-2 font-medium">Create acquisition</button>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{header}</h2>
        <ul className="mt-3 grid gap-2">
          {rows.map(a => (
            <li key={a.id} className="rounded-xl border border-black/10 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{a.source_name}</div>
                <div className="text-sm text-black/60">
                  {a.source_type} • £{(a.purchase_total_pence/100).toFixed(2)} • {a.status}
                </div>
                {a.notes ? <div className="text-sm text-black/60 mt-1">{a.notes}</div> : null}
              </div>
              <div className="flex items-center gap-3">
                <a className="text-sm underline" href={`/admin/acquisitions/${a.id}`}>Open</a>
                {a.status === "open" ? (
                  <button className="text-sm underline" onClick={() => toggleStatus(a.id, "closed")}>
                    Close
                  </button>
                ) : (
                  <button className="text-sm underline" onClick={() => toggleStatus(a.id, "open")}>
                    Reopen
                  </button>
        )}
              </div>
            </li>
          ))}
          {rows.length === 0 && <p className="text-sm text-black/60">No acquisitions.</p>}
        </ul>
      </section>
    </main>
  );
}
