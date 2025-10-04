import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PendingItem } from "@/lib/api";
import { fetchPending, runIngest, checkUnprocessedFiles, discardPending } from "@/lib/api";
export function PendingPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState(0);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchPending();
      setItems(data);
      
      // Check for unprocessed files
      try {
        const unprocessed = await checkUnprocessedFiles();
        setUnprocessedCount(unprocessed.count);
      } catch (e) {
        // If the endpoint doesn't exist yet, just ignore
        setUnprocessedCount(0);
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleIngest() {
    setIngesting(true);
    setErr(null);
    try {
      await runIngest(); // runs ingest synchronously by default
      await load();      // refresh list after ingest
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setIngesting(false);
    }
  }

  async function handleDelete(id: number) {
    if (confirm("Delete permanently? This cannot be undone.")) {
      try {
        await discardPending(id, "delete");
        await load(); // refresh list
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pending</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-alt))]"
            aria-label="Refresh"
          >
            Refresh
          </button>
          <button
            onClick={handleIngest}
            disabled={ingesting || unprocessedCount === 0}
            className={`px-3 py-1.5 rounded-lg text-white hover:opacity-90 disabled:opacity-60 ${
              unprocessedCount > 0 
                ? "bg-orange-500 animate-pulse" 
                : "bg-gray-400"
            }`}
          >
            {ingesting ? "Running…" : unprocessedCount > 0 ? `Run Ingest (${unprocessedCount})` : "Nothing to Ingest"}
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-[rgb(var(--danger))]">{err}</div>}
      {loading ? (
        <div className="text-sm text-[rgb(var(--muted-ink))]">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-[rgb(var(--muted-ink))]">No pending items.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <li
            key={it.id}
            className={`p-3 rounded-xl border ${
              it.dupes
                ? "border-[rgb(var(--danger))] bg-[rgb(var(--danger-soft))]/30"
                : "border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            }`}
          >
              <div className="flex gap-3">
                {it.front_url ? (
                  <img
                    src={it.front_url}
                    alt="front"
                    className="w-40 h-28 object-cover rounded border border-[rgb(var(--border))]"
                  />
                ) : (
                  <div className="w-40 h-28 rounded bg-[rgb(var(--panel))]" />
                )}
                {it.back_url ? (
                  <img
                    src={it.back_url}
                    alt="back"
                    className="w-40 h-28 object-cover rounded border border-[rgb(var(--border))]"
                  />
                ) : (
                  <div className="w-40 h-28 rounded bg-[rgb(var(--panel))]" />
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {it.dupes && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgb(var(--danger-soft))] text-[rgb(var(--danger))]">
                    Duplicate
                  </span>
                )}
                {it.qa_flags?.map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-[rgb(var(--panel))]">
                    {f}
                  </span>
                ))}
              </div>

              <div className="mt-2 text-xs text-[rgb(var(--muted-ink))] break-all">{it.key_front}</div>

              <div className="mt-3 flex gap-2">
                <Link
                  to={`/review/${it.id}`}
                  className="px-3 py-1.5 rounded bg-[rgb(var(--brand))] text-white hover:opacity-90"
                >
                  Review
                </Link>
                <button
                  onClick={() => handleDelete(it.id)}
                  className="px-3 py-1.5 rounded border border-[rgb(var(--danger))] text-[rgb(var(--danger))] hover:bg-[rgb(var(--danger-soft))]/30"
                  title="Delete permanently"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}


      <p className="text-xs text-[rgb(var(--muted-ink))]">
        Note: image links expire after ~15 minutes. Use Refresh to regenerate URLs.
      </p>
    </div>
  );
}