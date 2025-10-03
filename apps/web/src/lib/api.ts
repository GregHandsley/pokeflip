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