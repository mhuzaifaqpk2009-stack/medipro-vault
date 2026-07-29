import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/project-store";

/** Quick medicine lookup available from anywhere in the app. */
export function MedicineSearch() {
  const navigate = useNavigate();
  const meds = useProjectStore((s) => s.data?.medicines ?? []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return meds
      .filter((m) =>
        [m.name, m.genericName, m.company, m.barcode, m.batchNumber]
          .some((x) => (x ?? "").toLowerCase().includes(t)),
      )
      .slice(0, 8);
  }, [q, meds]);

  function goToMedicines(term: string) {
    sessionStorage.setItem("medicore.medsearch", term);
    setOpen(false);
    setQ("");
    navigate({ to: "/app/medicines" });
  }

  return (
    <div className="relative hidden w-full max-w-xs sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        placeholder="Search medicine..."
        className="h-9 pl-8"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) goToMedicines(q.trim());
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-md border bg-popover shadow-lg">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={() => {
                if (blurTimer.current) window.clearTimeout(blurTimer.current);
                goToMedicines(m.name);
              }}
            >
              <span className="truncate">{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                Stock {m.stockQuantity}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
