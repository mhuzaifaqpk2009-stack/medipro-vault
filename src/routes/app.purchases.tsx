import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Truck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import type { PurchaseItem } from "@/domain/schema";

export const Route = createFileRoute("/app/purchases")({ component: PurchasesPage });

function PurchasesPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Truck className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Purchases</h1><p className="text-sm text-muted-foreground">{data.purchases.length} purchase{data.purchases.length === 1 ? "" : "s"}</p></div>
        <Button className="ml-auto" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New purchase</Button>
      </header>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.purchases.length === 0 && <TableRow><TableCell colSpan={5} className="py-14 text-center text-sm text-muted-foreground">No purchases recorded.</TableCell></TableRow>}
            {data.purchases.map((p) => {
              const total = p.items.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
              const sup = data.suppliers.find((s) => s.id === p.supplierId);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                  <TableCell>{sup?.name ?? "—"}</TableCell>
                  <TableCell>{p.purchaseDate.slice(0, 10)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.items.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(total, sym)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {open && <NewPurchase onClose={() => setOpen(false)} onSave={(supplierId, invoice, items) => {
        mutate((d) => {
          for (const it of items) {
            const m = d.medicines.find((x) => x.id === it.medicineId);
            if (m) { m.stockQuantity += it.quantity; if (it.batchNumber) m.batchNumber = it.batchNumber; if (it.expiryDate) m.expiryDate = it.expiryDate; m.purchasePrice = it.purchasePrice; }
          }
          d.purchases.push({
            id: uid("pur_"), supplierId, invoiceNumber: invoice,
            purchaseDate: new Date().toISOString(), items, taxPercent: 0, discount: 0,
          });
        });
        toast.success("Purchase recorded · stock updated");
        setOpen(false);
      }} />}
    </div>
  );
}

function NewPurchase({ onClose, onSave }: {
  onClose: () => void;
  onSave: (supplierId: string, invoice: string, items: PurchaseItem[]) => void;
}) {
  const data = useProjectStore((s) => s.data!);
  const [supplier, setSupplier] = useState(data.suppliers[0]?.id ?? "");
  const [invoice, setInvoice] = useState(`PUR-${Date.now().toString(36).toUpperCase()}`);
  const [rows, setRows] = useState<PurchaseItem[]>([]);

  function addRow() {
    if (!data.medicines[0]) { toast.error("Add a medicine first"); return; }
    setRows((r) => [...r, { medicineId: data.medicines[0].id, quantity: 1, purchasePrice: data.medicines[0].purchasePrice, batchNumber: "", expiryDate: "" }]);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>New purchase</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Supplier *</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{data.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Invoice #</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
        </div>
        <div className="mt-3 rounded-md border">
          <div className="flex items-center justify-between border-b p-2">
            <span className="text-xs font-medium text-muted-foreground">Line items</span>
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="mr-1 h-3 w-3" />Add</Button>
          </div>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <div className="max-h-64 overflow-auto p-2">
              {rows.map((r, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr,80px,100px,120px,110px,32px] gap-2">
                  <Select value={r.medicineId} onValueChange={(v) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, medicineId: v } : x))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{data.medicines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" className="h-8" value={r.quantity || ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, quantity: +e.target.value || 1 } : x))} />
                  <Input type="number" className="h-8" value={r.purchasePrice || ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, purchasePrice: +e.target.value || 0 } : x))} />
                  <Input className="h-8" placeholder="Batch" value={r.batchNumber ?? ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, batchNumber: e.target.value } : x))} />
                  <Input type="date" className="h-8" value={r.expiryDate ?? ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, expiryDate: e.target.value } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!supplier) { toast.error("Pick a supplier"); return; }
            if (rows.length === 0) { toast.error("Add at least one item"); return; }
            onSave(supplier, invoice, rows);
          }}>Save & restock</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
