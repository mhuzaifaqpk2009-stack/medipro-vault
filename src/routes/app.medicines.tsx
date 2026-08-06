import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Search, Pencil, Trash2, AlertTriangle, CalendarX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid, money, useCurrencySymbol, daysUntil } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { pinContext } from "@/lib/pins";
import { useQuickAction, effectiveActionHotkey } from "@/lib/quick-actions";
import { comboFromEvent, normaliseCombo } from "@/lib/hotkeys";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Medicine } from "@/domain/schema";

export const Route = createFileRoute("/app/medicines")({
  component: () => <PermissionGate perm="medicines"><MedicinesPage /></PermissionGate>,
});

const empty = (): Medicine => ({
  id: "", name: "", genericName: "", company: "", batchNumber: "", barcode: "",
  purchasePrice: 0, salePrice: 0, mrp: 0, stockQuantity: 0, minimumStock: 5,
  expiryDate: "", rackNumber: "",
});

function MedicinesPage() {
  const meds = useProjectStore((s) => s.data!.medicines);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const [q, setQ] = useState(() => {
    const seed = typeof window !== "undefined" ? sessionStorage.getItem("medicore.medsearch") : null;
    if (seed) sessionStorage.removeItem("medicore.medsearch");
    return seed ?? "";
  });
  const [editing, setEditing] = useState<Medicine | null>(null);
  // Bumped whenever the form must start from scratch — remounts the editor so
  // no values from a previous entry survive.
  const [formKey, setFormKey] = useState(0);
  const [dupe, setDupe] = useState<{ m: Medicine; existingId: string; keepOpen: boolean } | null>(null);
  const openNew = () => { setFormKey((k) => k + 1); setEditing(empty()); };
  useQuickAction("new-medicine", openNew);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return meds;
    return meds.filter((m) =>
      [m.name, m.genericName, m.company, m.barcode, m.batchNumber, m.rackNumber]
        .some((x) => (x ?? "").toLowerCase().includes(s)),
    );
  }, [meds, q]);

  function commit(m: Medicine, keepOpen: boolean, overrideId?: string) {
    mutate((d) => {
      const targetId = m.id || overrideId;
      if (targetId) {
        const i = d.medicines.findIndex((x) => x.id === targetId);
        if (i >= 0) d.medicines[i] = { ...m, id: targetId };
      } else {
        d.medicines.push({ ...m, id: uid("med_") });
      }
    });
    toast.success(overrideId ? "Existing medicine updated" : "Medicine saved");
    if (keepOpen) { setFormKey((k) => k + 1); setEditing(empty()); }
    else setEditing(null);
  }

  function save(m: Medicine, keepOpen = false) {
    if (!m.name.trim()) { toast.error("Name is required"); return; }
    if (!m.id) {
      const key = m.name.trim().toLowerCase();
      const existing = meds.find((x) => x.name.trim().toLowerCase() === key);
      if (existing) { setDupe({ m, existingId: existing.id, keepOpen }); return; }
    }
    commit(m, keepOpen);
  }

  function remove(id: string) {
    if (!confirm("Delete this medicine?")) return;
    mutate((d) => { d.medicines = d.medicines.filter((m) => m.id !== id); });
    toast.success("Deleted");
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          <Pill className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Medicines</h1>
          <p className="text-sm text-muted-foreground">{meds.length} SKU{meds.length === 1 ? "" : "s"} in catalog</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input data-search placeholder="Search name, barcode, batch…" autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-72 pl-8" />
          </div>
          <Button {...pinContext({ id: "action:new-medicine", label: "New medicine", kind: "action", to: "/app/medicines" })} onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Add medicine</Button>
        </div>
      </header>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-14 text-center text-sm text-muted-foreground">No medicines. Add your first SKU.</TableCell></TableRow>
            )}
            {filtered.map((m) => {
              const low = m.stockQuantity <= (m.minimumStock ?? 0);
              const d = daysUntil(m.expiryDate);
              const expired = d !== null && d < 0;
              const near = d !== null && d >= 0 && d <= 30;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.genericName || m.company || "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.batchNumber || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{m.barcode || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={low ? "font-semibold text-warning" : ""}>{m.stockQuantity}</span>
                    {low && <AlertTriangle className="ml-1 inline h-3 w-3 text-warning" />}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(m.salePrice, sym)}</TableCell>
                  <TableCell className="text-xs">
                    {m.expiryDate ? (
                      <span className={expired ? "text-destructive font-medium" : near ? "text-warning" : ""}>
                        {m.expiryDate}{expired && <> · <CalendarX className="inline h-3 w-3" /></>}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setFormKey((k) => k + 1); setEditing(m); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <MedicineEditor key={formKey} value={editing} onCancel={() => setEditing(null)} onSave={save} />

      <AlertDialog open={!!dupe} onOpenChange={(o) => !o && setDupe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Medicine already exists</AlertDialogTitle>
            <AlertDialogDescription>
              A medicine named "{dupe?.m.name}" already exists. Override the existing one, or cancel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (dupe) commit(dupe.m, dupe.keepOpen, dupe.existingId); setDupe(null); }}
            >
              Override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MedicineEditor({ value, onCancel, onSave }: {
  value: Medicine | null; onCancel: () => void; onSave: (m: Medicine, keepOpen?: boolean) => void;
}) {
  const categories = useProjectStore((s) => s.data!.categories);
  const actionHotkeys = useProjectStore((s) => s.data!.settings.actionHotkeys);
  // The parent remounts this component (via `key`) for every new record, so
  // local state always starts from the record it was opened with.
  const [m, setM] = useState<Medicine | null>(value);
  const cur = m ?? value ?? empty();
  const quickCombo = effectiveActionHotkey("quick-add-medicine", actionHotkeys);

  useEffect(() => {
    if (!value || value.id) return;
    const onKey = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e);
      if (!combo || !quickCombo) return;
      if (normaliseCombo(combo) !== normaliseCombo(quickCombo)) return;
      e.preventDefault();
      e.stopPropagation();
      onSave(m ?? value, true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [value, m, quickCombo, onSave]);

  if (!value) return null;
  const upd = (k: keyof Medicine, v: any) => setM({ ...cur, [k]: v });

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{value.id ? "Edit medicine" : "New medicine"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Name *"><Input value={cur.name} onChange={(e) => upd("name", e.target.value)} autoFocus /></F>
          <F label="Generic name"><Input value={cur.genericName ?? ""} onChange={(e) => upd("genericName", e.target.value)} /></F>
          <F label="Company"><Input value={cur.company ?? ""} onChange={(e) => upd("company", e.target.value)} /></F>
          <F label="Category (optional)">
            <Select value={cur.categoryId || "none"} onValueChange={(v) => upd("categoryId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Uncategorised" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorised</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Barcode"><Input value={cur.barcode ?? ""} onChange={(e) => upd("barcode", e.target.value)} /></F>
          <F label="Batch #"><Input value={cur.batchNumber ?? ""} onChange={(e) => upd("batchNumber", e.target.value)} /></F>
          <F label="Rack"><Input value={cur.rackNumber ?? ""} onChange={(e) => upd("rackNumber", e.target.value)} /></F>
          <F label="Purchase price"><Input type="number" value={cur.purchasePrice || ""} onChange={(e) => upd("purchasePrice", +e.target.value || 0)} /></F>
          <F label="Sale price"><Input type="number" value={cur.salePrice || ""} onChange={(e) => upd("salePrice", +e.target.value || 0)} /></F>
          <F label="MRP"><Input type="number" value={cur.mrp || ""} onChange={(e) => upd("mrp", +e.target.value || 0)} /></F>
          <F label="Stock"><Input type="number" value={cur.stockQuantity || ""} onChange={(e) => upd("stockQuantity", +e.target.value || 0)} /></F>
          <F label="Minimum stock"><Input type="number" value={cur.minimumStock || ""} onChange={(e) => upd("minimumStock", +e.target.value || 0)} /></F>
          <F label="Expiry (YYYY-MM-DD)"><Input type="date" value={cur.expiryDate ?? ""} onChange={(e) => upd("expiryDate", e.target.value)} /></F>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          {!value.id && (
            <Button variant="secondary" onClick={() => onSave(cur, true)}>
              Quick Add{quickCombo ? ` (${quickCombo})` : ""}
            </Button>
          )}
          <Button onClick={() => onSave(cur)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>;
}
