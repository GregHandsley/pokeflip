import { Button } from "@/components/ui/Button";
import { Search } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-14 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-[rgb(var(--muted-ink))]" aria-hidden="true" />
        <input
          aria-label="Global search"
          placeholder="Search (Ctrl+/)"
          className="w-64 px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm focus-visible:ring-2"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm">Help</Button>
        <Button size="sm">Upload</Button>
      </div>
    </header>
  );
}