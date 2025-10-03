import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { getPresignedUrl } from "@/lib/api";

type Item = {
  id: string;
  file: File;
  progress: number;   // 0..100
  status: "queued" | "uploading" | "done" | "error";
  key?: string;
  error?: string;
};

export function UploadDropzone() {
  const [items, setItems] = useState<Item[]>([]);

  const onDrop = useCallback(async (accepted: File[]) => {
    const queued = accepted.map((f) => ({
      id: crypto.randomUUID(),
      file: f, progress: 0, status: "queued" as const
    }));
    setItems((s) => [...queued, ...s]);

    for (const it of queued) {
      try {
        const contentType = it.file.type || "application/octet-stream";
        const { key, url } = await getPresignedUrl(it.file.name, contentType);

        setItems((s) => s.map(x => x.id === it.id ? { ...x, status: "uploading", key } : x));

        await axios.put(url, it.file, {
          headers: { "Content-Type": contentType },
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setItems((s) => s.map(x => x.id === it.id ? { ...x, progress: pct } : x));
          },
          // In case your corporate proxy messes with PUT, you can try maxBodyLength: Infinity
        });

        setItems((s) => s.map(x => x.id === it.id ? { ...x, progress: 100, status: "done" } : x));
      } catch (e: any) {
        setItems((s) => s.map(x => x.id === it.id ? { ...x, status: "error", error: String(e) } : x));
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/*": [] }
  });

  return (
    <div className="p-6 space-y-6">
      <div
        {...getRootProps()}
        className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                   hover:bg-[rgb(var(--surface-alt))] border-[rgb(var(--border))]"
        aria-label="Image upload dropzone"
      >
        <input {...getInputProps()} />
        <p className="text-sm text-[rgb(var(--muted-ink))]">
          {isDragActive ? "Drop to upload…" : "Drag & drop images, or click to select"}
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="border rounded-lg p-3 border-[rgb(var(--border))]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{it.file.name}</div>
                <div className="text-xs text-[rgb(var(--muted-ink))]">
                  {it.key ? it.key : "inbox/unsorted/<pending>"}
                </div>
              </div>
              <div className="text-xs">{it.status}</div>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-[rgb(var(--panel))]">
              <div
                className="h-2 rounded bg-[rgb(var(--brand))] transition-[width]"
                style={{ width: `${it.progress}%` }}
              />
            </div>
            {it.error && <div className="text-xs text-[rgb(var(--danger))] mt-2">{it.error}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}