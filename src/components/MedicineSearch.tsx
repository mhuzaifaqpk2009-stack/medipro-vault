import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { SearchInput } from "@/components/SearchInput";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { money } from "@/lib/format";

type SearchBy = "name" | "generic" | "company";
const SEARCH_BY_LABEL: Record<SearchBy, string> = { name: "Name", generic: "Generic", company: "Company" };

/** Quick medicine lookup available from anywhere in the app. */
export function MedicineSearch() {
  const navigate = useNavigate();
  const meds = useProjectStore((s) => s.data?.medicines ?? []);
  const defaultBy = useProjectStore((s) => s.data?.settings.defaultSearchBy ?? "name");
  const sym = useProjectStore((s) => s.data?.settings.currencySymbol || "$");
  const [q, setQ] = useState("");
  const [by, setBy] = useState<SearchBy>(defaultBy);
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const field = (m: (typeof meds)[number]) =>
      by === "generic" ? m.genericName : by === "company" ? m.company : m.name;
    return meds.filter((m) => (field(m) ?? "").toLowerCase().includes(t)).slice(0, 8);
  }, [q, meds, by]);

  function goToMedicines(term: string) {
    sessionStorage.setItem("medicore.medsearch", term);
    setOpen(false);
    setQ("");
    navigate({ to: "/app/medicines" });
  }

  const placeholders: Record<SearchBy, string[]> = {
    name: ["Search medicine name…", "Search by barcode…", "Search by batch…"],
    generic: ["Search generic name…"],
    company: ["Search company name…"],
  };

  return (
    <div className="hidden w-full max-w-md sm:flex sm:items-center sm:gap-1.5">
      <Select value={by} onValueChange={(v) => setBy(v as SearchBy)}>
        <SelectTrigger className="h-9 w-[104px] shrink-0 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="generic">Generic</SelectItem>
          <SelectItem value="company">Company</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <SearchInput
          data-global-search
          phrases={placeholders[by]}
          value={q}
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
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span>Stock {m.stockQuantity}</span>
                  <span className="tabular-nums">{money(m.salePrice, sym)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
