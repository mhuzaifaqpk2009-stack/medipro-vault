import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Search, Pencil, Trash2, AlertTriangle, CalendarX, History } from "lucide-react";
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
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Medicine } from "@/domain/schema";
import { isMultiMode } from "@/lib/install";
import { isAdmin, currentUser } from "@/store/session-store";
import { logMedicineAudit, getMedicineAuditLog, type AuditEntry } from "@/lib/audit-log";
import { canAddMedicine, canEditMedicine, canDeleteMedicine } from "@/lib/granular-permissions";
import { ArrowUpDown, Pin, PinOff } from "lucide-react";

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
  const sales = useProjectStore((s) => s.data!.sales);
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
  const [historyFor, setHistoryFor] = useState<Medicine | null>(null);
  const user = currentUser();
  const canSeeHistory = isMultiMode() && isAdmin();
  const canAdd = canAddMedicine(user);
  const canEdit = canEditMedicine(user);
  const canDelete = canDeleteMedicine(user);
  const canPin = canEdit; // pinning is a lightweight edit action
  const openNew = () => { if (!canAdd) return; setFormKey((k) => k + 1); setEditing(empty()); };
  useQuickAction("new-medicine", openNew);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return meds;
    return meds.filter((m) =>
      [m.name, m.genericName, m.company, m.barcode, m.batchNumber, m.rackNumber]
        .some((x) => (x ?? "").toLowerCase().includes(s)),
    );
  }, [meds, q]);

  type SortBy = "name" | "expiry" | "lowStock" | "topSelling";
  const [sortBy, setSortBy] = useState<SortBy>("name");

  const qtySoldMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      if (s.status === "cancelled") continue;
      for (const it of s.items) map.set(it.medicineId, (map.get(it.medicineId) ?? 0) + it.quantity);
    }
    return map;
  }, [sales]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp: Record<SortBy, (a: Medicine, b: Medicine) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      expiry: (a, b) => (a.expiryDate || "9999-99-99").localeCompare(b.expiryDate || "9999-99-99"),
      lowStock: (a, b) => (a.stockQuantity - (a.minimumStock ?? 0)) - (b.stockQuantity - (b.minimumStock ?? 0)),
      topSelling: (a, b) => (qtySoldMap.get(b.id) ?? 0) - (qtySoldMap.get(a.id) ?? 0),
    };
    arr.sort(cmp[sortBy]);
    // Manual "Make first"/"Make last" pins always win over whatever sort is chosen.
    const first = arr.filter((m) => m.pinOrder === "first");
    const last = arr.filter((m) => m.pinOrder === "last");
    const rest = arr.filter((m) => m.pinOrder !== "first" && m.pinOrder !== "last");
    return [...first, ...rest, ...last];
  }, [filtered, sortBy, qtySoldMap]);

  // Pagination — rendering thousands of <TableRow> at once is what actually
  // causes lag at real scale, not the SQLite database underneath (SQLite
  // handles far more rows than any real pharmacy inventory needs without
  // trouble). Keeping the page size modest keeps the DOM small regardless
  // of how large the catalog grows.
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [q, sortBy]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(
    () => sorted.slice(pageStart, pageStart + PAGE_SIZE),
    [sorted, pageStart],
  );

  function setPin(id: string, pin: "first" | "last" | undefined) {
    mutate((d) => {
      const i = d.medicines.findIndex((x) => x.id === id);
      if (i >= 0) d.medicines[i] = { ...d.medicines[i], pinOrder: pin };
    });
  }

  function commit(m: Medicine, keepOpen: boolean, overrideId?: string) {
    const targetId = m.id || overrideId;
    const isEdit = !!targetId;
    const finalId = targetId || uid("med_");
    mutate((d) => {
      if (targetId) {
        const i = d.medicines.findIndex((x) => x.id === targetId);
        if (i >= 0) d.medicines[i] = { ...m, id: targetId };
      } else {
        d.medicines.push({ ...m, id: finalId });
      }
    });
    toast.success(overrideId ? "Existing medicine updated" : "Medicine saved");
    const user = currentUser();
    void logMedicineAudit({
      entityId: finalId,
      action: isEdit ? "edit" : "add",
      username: user?.username,
      userId: user?.id,
      medicineName: m.name,
      quantity: m.stockQuantity,
      price: m.salePrice,
    });
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
    if (!canDelete) return;
    if (!confirm("Delete this medicine?")) return;
    const m = meds.find((x) => x.id === id);
    mutate((d) => { d.medicines = d.medicines.filter((m) => m.id !== id); });
    const u = currentUser();
    void logMedicineAudit({
      entityId: id, action: "delete",
      username: u?.username, userId: u?.id,
      medicineName: m?.name, quantity: m?.stockQuantity, price: m?.salePrice,
    });
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-9 w-40"><ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="expiry">Expiry date</SelectItem>
              <SelectItem value="lowStock">Low stock</SelectItem>
              <SelectItem value="topSelling">Top selling</SelectItem>
            </SelectContent>
          </Select>
          {canAdd && (
            <Button {...pinContext({ id: "action:new-medicine", label: "New medicine", kind: "action", to: "/app/medicines" })} onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Add medicine</Button>
          )}
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
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-14 text-center text-sm text-muted-foreground">No medicines. Add your first SKU.</TableCell></TableRow>
            )}
            {pageItems.map((m) => (
              <MedicineRow
                key={m.id}
                m={m}
                sym={sym}
                canSeeHistory={canSeeHistory}
                canEdit={canEdit}
                canDelete={canDelete}
                canPin={canPin}
                onEdit={() => { if (!canEdit) return; setFormKey((k) => k + 1); setEditing(m); }}
                onDelete={() => remove(m.id)}
                onHistory={() => setHistoryFor(m)}
                onPin={(pin) => setPin(m.id, pin)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="tabular-nums">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}

      <MedicineHistoryDialog medicine={historyFor} onClose={() => setHistoryFor(null)} />

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

/**
 * A single medicine row. Single computer mode (or a non-admin in Multi
 * computer mode) gets exactly the plain row that existed before this
 * feature — `canSeeHistory` only wraps it in a right-click menu when true,
 * so nothing changes visually otherwise.
 */
function MedicineRow({ m, sym, canSeeHistory, canEdit, canDelete, canPin, onEdit, onDelete, onHistory, onPin }: {
  m: Medicine; sym: string; canSeeHistory: boolean; canEdit: boolean; canDelete: boolean; canPin: boolean;
  onEdit: () => void; onDelete: () => void; onHistory: () => void; onPin: (pin: "first" | "last" | undefined) => void;
}) {
  const low = m.stockQuantity <= (m.minimumStock ?? 0);
  const d = daysUntil(m.expiryDate);
  const expired = d !== null && d < 0;
  const near = d !== null && d >= 0 && d <= 30;

  const row = (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1.5 font-medium">
          {m.pinOrder && <Pin className="h-3 w-3 shrink-0 text-primary" />}
          {m.name}
        </div>
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
        {canEdit && <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>}
        {canDelete && <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
      </TableCell>
    </TableRow>
  );

  if (!canSeeHistory && !canPin) return row;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        {canSeeHistory && (
          <ContextMenuItem onSelect={onHistory}>
            <History className="mr-2 h-4 w-4" /> Report
          </ContextMenuItem>
        )}
        {canPin && (
          <>
            <ContextMenuItem onSelect={() => onPin("first")}>
              <Pin className="mr-2 h-4 w-4" /> Make first
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onPin("last")}>
              <Pin className="mr-2 h-4 w-4 rotate-180" /> Make last
            </ContextMenuItem>
            {m.pinOrder && (
              <ContextMenuItem onSelect={() => onPin(undefined)}>
                <PinOff className="mr-2 h-4 w-4" /> Clear pin
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Part 6: full add/edit history for one medicine, Admin + Multi computer mode only. */
function MedicineHistoryDialog({ medicine, onClose }: { medicine: Medicine | null; onClose: () => void }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const sym = useCurrencySymbol();

  useEffect(() => {
    if (!medicine) return;
    let cancelled = false;
    setLoading(true);
    getMedicineAuditLog(medicine.id)
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [medicine]);

  return (
    <Dialog open={!!medicine} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[75vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{medicine?.name} — history</DialogTitle></DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No recorded history for this medicine yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="py-2.5 text-sm">
                <span className="font-medium">{e.action === "add" ? "Added" : "Edited"} by {e.username || "Unknown"}</span>
                <span className="text-muted-foreground"> on {new Date(e.timestamp).toLocaleString()}</span>
                {" — "}
                {e.quantity ?? 0} stock at {money(e.price ?? 0, sym)}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
