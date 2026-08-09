import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, Star, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid } from "@/lib/format";
import { pinContext } from "@/lib/pins";
import { useQuickAction } from "@/lib/quick-actions";
import type { Customer } from "@/domain/schema";

export const Route = createFileRoute("/app/customers")({ component: CustomersPage });

const empty = (): Customer => ({ id: "", name: "", phone: "", email: "", address: "", balance: 0, loyaltyPoints: 0, specialDiscountPercent: 0 });
const PAGE_SIZE = 100;

function CustomersPage() {
  const list = useProjectStore((s) => s.data!.customers);
  const mutate = useProjectStore((s) => s.mutate);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  useQuickAction("new-customer", () => setEditing(empty()));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((c) => [c.name, c.phone, c.email].some((x) => (x ?? "").toLowerCase().includes(s)));
  }, [list, q]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(() => filtered.slice(pageStart, pageStart + PAGE_SIZE), [filtered, pageStart]);

  function save(c: Customer) {
    if (!c.name.trim()) { toast.error("Name required"); return; }
    mutate((d) => {
      if (c.id) {
        const i = d.customers.findIndex((x) => x.id === c.id);
        if (i >= 0) d.customers[i] = c;
      } else d.customers.push({ ...c, id: uid("cus_") });
    });
    setEditing(null);
    toast.success("Saved");
  }
  function remove(id: string) {
    if (!confirm("Delete customer?")) return;
    mutate((d) => { d.customers = d.customers.filter((c) => c.id !== id); });
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Users className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Customers</h1><p className="text-sm text-muted-foreground">{list.length} customer{list.length === 1 ? "" : "s"}</p></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64 pl-8" />
          </div>
          <Button {...pinContext({ id: "action:new-customer", label: "New customer", kind: "action", to: "/app/customers" })} onClick={() => setEditing(empty())}><Plus className="mr-1.5 h-4 w-4" />Add customer</Button>
        </div>
      </header>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead>
            <TableHead className="text-right">Points</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">No customers yet.</TableCell></TableRow>}
            {pageItems.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell>{c.email || "—"}</TableCell>
                <TableCell className="text-right tabular-nums"><Star className="mr-1 inline h-3 w-3 text-warning" />{c.loyaltyPoints}</TableCell>
                <TableCell className="text-right tabular-nums">{c.balance.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

function Editor({ value, onCancel, onSave }: { value: Customer; onCancel: () => void; onSave: (c: Customer) => void }) {
  const [c, setC] = useState(value);
  const upd = (k: keyof Customer, v: any) => setC({ ...c, [k]: v });
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent><DialogHeader><DialogTitle>{value.id ? "Edit" : "New"} customer</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Name *</Label><Input value={c.name} placeholder="Customer name" onChange={(e) => upd("name", e.target.value)} autoFocus /></div>
          <div><Label className="text-xs">Phone</Label><Input value={c.phone ?? ""} placeholder="03xx xxxxxxx" onChange={(e) => upd("phone", e.target.value)} /></div>
          <div><Label className="text-xs">Email</Label><Input value={c.email ?? ""} placeholder="name@example.com" onChange={(e) => upd("email", e.target.value)} /></div>
          <div><Label className="text-xs">Address</Label><Input value={c.address ?? ""} placeholder="Street, city" onChange={(e) => upd("address", e.target.value)} /></div>
          <div><Label className="text-xs">Points</Label><Input type="number" placeholder="0" value={c.loyaltyPoints || ""} onChange={(e) => upd("loyaltyPoints", +e.target.value || 0)} /></div>
          <div><Label className="text-xs">Balance</Label><Input type="number" placeholder="0" value={c.balance || ""} onChange={(e) => upd("balance", +e.target.value || 0)} /></div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Special discount % (auto-applied at checkout)</Label>
            <Input
              type="number"
              placeholder="e.g. 10"
              value={c.specialDiscountPercent || ""}
              onChange={(e) => upd("specialDiscountPercent", +e.target.value || 0)}
            />
          </div>
        </div>

        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(c)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
