"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { poundsToPence } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { formatDateOnly } from "@/lib/utils/format";

type Acquisition = {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  notes: string | null;
  status: "open" | "closed";
};

const generatePurchaseSKU = async (
  supabase: ReturnType<typeof supabaseBrowser>
): Promise<string> => {
  // Get all existing purchases with PUR- prefix
  const { data } = await supabase
    .from("acquisitions")
    .select("source_name")
    .like("source_name", "PUR-%");

  // Extract numbers from existing SKUs and find the highest
  let maxNum = 0;
  if (data) {
    for (const acquisition of data as Array<{ source_name: string }>) {
      const match = acquisition.source_name?.match(/^PUR-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  // Generate next sequential number
  const nextNum = maxNum + 1;
  return `PUR-${String(nextNum).padStart(3, "0")}`;
};

export default function AcquisitionsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [rows, setRows] = useState<Acquisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("packs");
  const [total, setTotal] = useState("0.00");
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const q = supabase
        .from("acquisitions")
        .select("id, source_name, source_type, purchase_total_pence, purchased_at, notes, status")
        .order("created_at", { ascending: false });

      const { data, error } = await q.eq("status", filter);

      if (error) setMsg(error.message);
      else setRows((data ?? []) as Acquisition[]);
      setLoading(false);
    };

    void load();
  }, [filter, supabase]);

  useEffect(() => {
    if (showCreateModal) {
      generatePurchaseSKU(supabase).then((sku) => {
        setSourceName(sku);
      });
    }
  }, [showCreateModal, supabase]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setCreating(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("acquisitions") as any)
      .insert({
        source_name: sourceName,
        source_type: sourceType,
        purchase_total_pence: poundsToPence(total),
        purchased_at: new Date(purchasedAt + "T12:00:00Z").toISOString(),
        notes: notes.trim() ? notes.trim() : null,
        status: "open",
      })
      .select("id")
      .single();

    if (error) {
      setMsg(error.message);
      setCreating(false);
    } else {
      // Reset form
      setSourceName("");
      setTotal("0.00");
      setNotes("");
      setShowCreateModal(false);
      setCreating(false);

      // Navigate to the intake workspace for this acquisition
      if (data?.id) {
        router.push(`/admin/acquisitions/${data.id}`);
      }
    }
  };

  // Use shared format utility
  const formatDate = formatDateOnly;

  const header = useMemo(() => {
    return filter === "open" ? "Open Purchases" : "Closed Purchases";
  }, [filter]);

  return (
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
          <p className="mt-1 text-black/60">
            Create a purchase, add cards to draft cart, then commit to inventory.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Create Purchase
        </Button>
      </div>

      <div className="mt-5 flex gap-2">
        {(["open", "closed"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-lg px-3 py-1.5 text-sm border border-black/10 font-medium transition-colors ${
              filter === v ? "bg-black text-white" : "bg-white hover:bg-black/5"
            }`}
          >
            {v === "open" ? "Open" : "Closed"}
          </button>
        ))}
      </div>

      {/* Create Purchase Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setMsg(null);
        }}
        title="Create New Purchase"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setMsg(null);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="create-purchase-form" disabled={creating}>
              {creating ? "Creating..." : "Create & Add Cards"}
            </Button>
          </div>
        }
      >
        <form id="create-purchase-form" onSubmit={create} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Source (seller/shop)
              <input
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </label>

            <label className="text-sm">
              Type
              <select
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                <option value="packs">Packs</option>
                <option value="collection">Collection</option>
                <option value="singles">Singles</option>
                <option value="trade">Trade</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Total cost (£)
              <input
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="decimal"
              />
            </label>

            <label className="text-sm">
              Purchase date
              <input
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
              />
            </label>
          </div>

          <label className="text-sm">
            Notes
            <textarea
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 min-h-[72px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </form>
      </Modal>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{header}</h2>
        {loading ? (
          <div className="mt-3 text-sm text-black/60">Loading...</div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {rows.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-black/10 bg-white p-4 flex items-center justify-between hover:border-black/20 transition-colors cursor-pointer"
                onClick={(e) => {
                  // Don't navigate if clicking on buttons
                  if ((e.target as HTMLElement).closest("button, a")) {
                    return;
                  }
                  router.push(`/admin/acquisitions/${a.id}/lots`);
                }}
              >
                <div className="flex-1">
                  <div className="font-medium text-base">{a.source_name}</div>
                  <div className="text-sm text-black/60 mt-1">
                    <span className="capitalize">{a.source_type}</span>
                    {" • "}
                    <span className="font-medium">
                      £{(a.purchase_total_pence / 100).toFixed(2)}
                    </span>
                    {" • "}
                    {formatDate(a.purchased_at)}
                    {" • "}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        a.status === "open"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {a.status === "open" ? "Open" : "Closed"}
                    </span>
                  </div>
                  {a.notes && <div className="text-sm text-black/60 mt-2 italic">{a.notes}</div>}
                </div>
                <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`/admin/acquisitions/${a.id}`}
                    className="px-3 py-1.5 rounded-lg border border-black/10 bg-white text-sm font-medium hover:bg-black/5 transition-colors"
                  >
                    Add Cards
                  </a>
                  <a
                    href={`/admin/acquisitions/${a.id}/lots`}
                    className="px-3 py-1.5 rounded-lg border border-black/10 bg-white text-sm font-medium hover:bg-black/5 transition-colors"
                  >
                    View Cards
                  </a>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <div className="rounded-xl border border-black/10 bg-white p-8 text-center">
                <p className="text-sm text-black/60">No purchases found.</p>
              </div>
            )}
          </ul>
        )}
      </section>
    </main>
  );
}
