import { Link } from "react-router-dom";
import FlipThumb from "@/components/media/FlipThumb";
import type { CardListItem } from "@/lib/api";

export default function CardTile({
  c,
  onOpenViewer,
  onCopyTitle,
  onCopyDesc,
  busy,
}: {
  c: CardListItem;
  onOpenViewer: (c: CardListItem) => void;
  onCopyTitle: (sku: string) => void;
  onCopyDesc: (sku: string) => void;
  busy?: string | null;
}) {
  return (
    <li
        className="h-full rounded-2xl border border-[rgb(var(--border))]
                    bg-[rgb(var(--surface))] shadow-[0_1px_0_rgb(0_0_0/0.03)]
                    transition-shadow hover:shadow-md
                    flex flex-col p-4"
        >
      {/* Media */}
      <div className="mb-3">
        <FlipThumb
          front={c.thumbs.front}
          back={c.thumbs.back}
          size="list"
          onOpen={() => onOpenViewer(c)}
          className="w-full"
        />
      </div>

      {/* Meta (centered, clamped) */}
      <div className="text-center">
        <div className="text-sm font-semibold">{c.sku}</div>
        <div className="text-xs text-[rgb(var(--muted-ink))] truncate">{c.name}</div>
      </div>

      {/* Spacer pushes actions to bottom so tiles align */}
      <div className="mt-auto" />

      {/* Actions */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Link
          to={`/cards/${encodeURIComponent(c.sku)}`}
          className="col-span-1 flex items-center justify-center px-3 py-1.5 rounded
                     bg-[rgb(var(--brand))] text-white hover:opacity-90"
        >
          Open
        </Link>
        <button
          onClick={() => onCopyTitle(c.sku)}
          disabled={busy === c.sku + ":title"}
          className="col-span-1 px-3 py-1.5 rounded text-center
                     border border-[rgb(var(--border))]
                     hover:bg-[rgb(var(--surface-alt))]"
        >
          {busy === c.sku + ":title" ? "…" : "Copy Title"}
        </button>
        <button
          onClick={() => onCopyDesc(c.sku)}
          disabled={busy === c.sku + ":description"}
          className="col-span-1 px-3 py-1.5 rounded text-center
                     border border-[rgb(var(--border))]
                     hover:bg-[rgb(var(--surface-alt))]"
        >
          {busy === c.sku + ":description" ? "…" : "Copy Desc"}
        </button>
      </div>
    </li>
  );
}