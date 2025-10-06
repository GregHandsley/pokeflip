export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getPresignedUrl(filename: string, contentType: string) {
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) throw new Error(`Presign failed: ${res.status}`);
  return (await res.json()) as { key: string; url: string };
}

export type PendingItem = {
  id: number;
  key_front: string | null;
  key_back: string | null;
  front_url: string | null;
  back_url: string | null;
  qa_flags: string[];
  dupes: boolean;
};

export async function fetchPending(): Promise<PendingItem[]> {
  const res = await fetch(`${API_BASE}/pending`);
  if (!res.ok) throw new Error(`GET /pending ${res.status}`);
  const data = await res.json();
  return data.items as PendingItem[];
}

export async function stagePending(
  id: number,
  payload: {
    name: string;
    set: string;
    number: string;
    language: string;
    condition: string;
    holo: boolean;
  }
) {
  const res = await fetch(`${API_BASE}/pending/${id}/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /pending/${id}/stage ${res.status}`);
  return res.json() as Promise<{ sku: string; front_url: string | null; back_url: string | null }>;
}


export type IngestResult = {
  mode: "queued" | "inline" | "inline-fallback";
  job_id?: string;
  result?: {
    pairs: number;
    inserted: number;
    skipped_existing: number;
    dupes_flagged: number;
  };
};

export async function runIngest(prefix = "inbox/unsorted/", sync = true): Promise<IngestResult> {
  const res = await fetch(`${API_BASE}/ingest/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sync ? { prefix, sync: true } : { prefix }),
  });
  if (!res.ok) throw new Error(`POST /ingest/run ${res.status}`);
  return res.json() as Promise<IngestResult>;
}

export async function discardPending(id: number, mode: "trash" | "delete" = "trash") {
  const res = await fetch(`${API_BASE}/pending/${id}/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`POST /pending/${id}/discard ${res.status}`);
  return res.json() as Promise<{status:"ok"; mode:string; deleted:number}>;
}

export async function checkUnprocessedFiles() {
  const res = await fetch(`${API_BASE}/ingest/check`);
  if (!res.ok) throw new Error(`GET /ingest/check ${res.status}`);
  return res.json() as Promise<{count: number; files: string[]}>;
}

export type ThumbBundle = {
  list:   { webp: string; jpeg: string };
  detail: { webp: string; jpeg: string };
  zoom:   { webp: string; jpeg: string };
};
export type CardListItem = {
  sku: string;
  name: string;
  set: string;
  number: string;
  language: string;
  condition: string;
  holo: boolean;
  thumbs: { front: ThumbBundle | null; back: ThumbBundle | null };
};
export async function fetchCards(): Promise<CardListItem[]> {
  const res = await fetch(`${API_BASE}/cards`);
  if (!res.ok) throw new Error(`GET /cards ${res.status}`);
  return (await res.json()).items as CardListItem[];
}
export async function fetchCard(sku: string) {
  const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(sku)}`);
  if (!res.ok) throw new Error(`GET /cards/${sku} ${res.status}`);
  return res.json() as Promise<{
    sku: string;
    name: string;
    set: string;
    number: string;
    language: string;
    condition: string;
    holo: boolean;
    thumbs: { front: ThumbBundle | null; back: ThumbBundle | null };
    title: string; description: string;
  }>;
}