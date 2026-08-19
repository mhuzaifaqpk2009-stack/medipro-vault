import type { KeyboardEvent } from "react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";
import { currentUser } from "@/store/session-store";
import { Input } from "@/components/ui/input";

export function RackPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const data = useProjectStore((s) => s.data);
  const mutate = useProjectStore((s) => s.mutate);
  const racks = useMemo(() => (data?.settings.racks ?? []).filter((r) => r.active), [data?.settings.racks]);
  const user = currentUser();
  const canAddRack = user?.role === "admin" || user?.roleTemplate === "manager" || user?.permissions.racksAdd === true;
  const listId = "medicine-rack-options";
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const name = value.trim();
    if (!name || racks.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) return;
    e.preventDefault();
    if (!canAddRack) { toast.error("Rack does not exist. Ask an administrator or manager to add it."); return; }
    if (!window.confirm(`Rack "${name}" does not exist. Do you want to add the rack?`)) return;
    mutate((d) => {
      const list = d.settings.racks ?? [];
      if (!list.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) d.settings.racks = [...list, { id: crypto.randomUUID(), name, description: "", active: true, createdAt: new Date().toISOString() }];
    });
    toast.success(`Rack "${name}" added`);
  }
  return <div className="space-y-1.5"><div className="relative"><Input list={listId} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={racks.length ? "Select or type a rack…" : "No rack — type a rack name"} aria-label="Rack" className="pr-8" /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">▾</span></div><datalist id={listId}>{racks.map((r) => <option key={r.id} value={r.name}>{r.description ?? ""}</option>)}</datalist>{racks.length === 0 && <p className="text-[11px] text-muted-foreground">No rack available. Type a rack name and press Enter to add it if your account has rack-add permission.</p>}</div>;
}
