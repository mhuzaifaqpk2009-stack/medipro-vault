import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { pinContext } from "@/lib/pins";
import { useQuickAction } from "@/lib/quick-actions";
import type { Supplier } from "@/domain/schema";

export const Route = createFileRoute("/app/suppliers")({
  component: () => <PermissionGate perm="suppliers"><SuppliersPage /></PermissionGate>,
});

const empty = (): Supplier => ({ id: "", name: "", phone: "", email: "", address: "", company: "", balance: 0 });
const PAGE_SIZE = 100;

function SuppliersPage() {
  const list = useProjectStore((s) => s.data!.suppliers);
  const mutate = useProjectStore((s) => s.mutate);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [q, setQ] = useState("");
  useQuickAction("new-supplier", () => setEditing(empty()));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) => [x.name, x.company, x.phone, x.email].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [list, q]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(() => filtered.slice(pageStart, pageStart + PAGE_SIZE), [filtered, pageStart]);

  function save(v: Supplier) {
    if (!v.name.trim()) { toast.error("Name required"); return; }
    mutate((d) => {
      if (v.id) {
        const i = d.suppliers.findIndex((x) => x.id === v.id);
        if (i >= 0) d.suppliers[i] = v;
      } else d.suppliers.push({ ...v, id: uid("sup_") });
    });
    setEditing(null);
    toast.success("Saved");
  }
  function remove(id: string) {
    if (!confirm("Delete supplier?")) return;
    mutate((d) => { d.suppliers = d.suppliers.filter((s) => s.id !== id); });
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Building2 className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Suppliers</h1><p className="text-sm text-muted-foreground">{list.length} vendor{list.length === 1 ? "" : "s"}</p></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, company, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64 pl-8" />
          </div>
          <Button {...pinContext({ id: "action:new-supplier", label: "New supplier", kind: "action", to: "/app/suppliers" })} onClick={() => setEditing(empty())}><Plus className="mr-1.5 h-4 w-4" />Add supplier</Button>
        </div>
      </header>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Phone</TableHead>
            <TableHead>Email</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">No suppliers yet.</TableCell></TableRow>}
            {pageItems.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.company || "—"}</TableCell>
                <TableCell>{s.phone || "—"}</TableCell>
                <TableCell>{s.email || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{s.balance.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <span className="tabular-nums">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        </div>
      )}

      {editing && <Editor value={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function Editor({ value, onCancel, onSave }: { value: Supplier; onCancel: () => void; onSave: (v: Supplier) => void }) {
  const [v, setV] = useState(value);
  const upd = (k: keyof Supplier, x: any) => setV({ ...v, [k]: x });
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent><DialogHeader><DialogTitle>{value.id ? "Edit" : "New"} supplier</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Name *</Label><Input value={v.name} onChange={(e) => upd("name", e.target.value)} placeholder="Supplier name" autoFocus /></div>
          <div><Label className="text-xs">Company</Label><Input value={v.company ?? ""} onChange={(e) => upd("company", e.target.value)} placeholder="Company name" /></div>
          <div><Label className="text-xs">Phone</Label><Input value={v.phone ?? ""} onChange={(e) => upd("phone", e.target.value)} placeholder="Phone number" /></div>
          <div><Label className="text-xs">Email</Label><Input value={v.email ?? ""} onChange={(e) => upd("email", e.target.value)} placeholder="Email address" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Address</Label><Input value={v.address ?? ""} onChange={(e) => upd("address", e.target.value)} placeholder="Supplier address" /></div>
          <div><Label className="text-xs">Balance</Label><Input type="number" value={v.balance || ""} onChange={(e) => upd("balance", +e.target.value || 0)} placeholder="0.00" /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(v)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
