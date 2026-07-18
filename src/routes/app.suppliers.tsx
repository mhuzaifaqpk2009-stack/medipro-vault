import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid } from "@/lib/format";
import type { Supplier } from "@/domain/schema";

export const Route = createFileRoute("/app/suppliers")({ component: SuppliersPage });

const empty = (): Supplier => ({ id: "", name: "", phone: "", email: "", address: "", company: "", balance: 0 });

function SuppliersPage() {
  const list = useProjectStore((s) => s.data!.suppliers);
  const mutate = useProjectStore((s) => s.mutate);
  const [editing, setEditing] = useState<Supplier | null>(null);

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
        <Button className="ml-auto" onClick={() => setEditing(empty())}><Plus className="mr-1.5 h-4 w-4" />Add supplier</Button>
      </header>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Phone</TableHead>
            <TableHead>Email</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">No suppliers yet.</TableCell></TableRow>}
            {list.map((s) => (
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
          <div><Label className="text-xs">Name *</Label><Input value={v.name} onChange={(e) => upd("name", e.target.value)} autoFocus /></div>
          <div><Label className="text-xs">Company</Label><Input value={v.company ?? ""} onChange={(e) => upd("company", e.target.value)} /></div>
          <div><Label className="text-xs">Phone</Label><Input value={v.phone ?? ""} onChange={(e) => upd("phone", e.target.value)} /></div>
          <div><Label className="text-xs">Email</Label><Input value={v.email ?? ""} onChange={(e) => upd("email", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Address</Label><Input value={v.address ?? ""} onChange={(e) => upd("address", e.target.value)} /></div>
          <div><Label className="text-xs">Balance</Label><Input type="number" value={v.balance} onChange={(e) => upd("balance", +e.target.value || 0)} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(v)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
