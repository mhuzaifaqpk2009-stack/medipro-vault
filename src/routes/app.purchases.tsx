import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { pinContext } from "@/lib/pins";
import { useQuickAction } from "@/lib/quick-actions";
import { cn } from "@/lib/utils";
import type { PurchaseItem, Medicine } from "@/domain/schema";

export const Route = createFileRoute("/app/purchases")({
  component: () => <PermissionGate perm="purchases"><PurchasesPage /></PermissionGate>,
});

function PurchasesPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const [open, setOpen] = useState(false);
  useQuickAction("new-purchase", () => setOpen(true));

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Truck className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Purchases</h1><p className="text-sm text-muted-foreground">{data.purchases.length} purchase{data.purchases.length === 1 ? "" : "s"}</p></div>
        <Button className="ml-auto" {...pinContext({ id: "action:new-purchase", label: "New purchase", kind: "action", to: "/app/purchases" })} onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New purchase</Button>
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
                  <TableCell>{sup?.name ?? <span className="text-muted-foreground">Untagged</span>}</TableCell>
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
  const [supplier, setSupplier] = useState("");
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
          <div><Label className="text-xs">Supplier (optional)</Label>
            <Select value={supplier || "__none"} onValueChange={(v) => setSupplier(v === "__none" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Untagged" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Untagged (no supplier)</SelectItem>
                {data.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
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
            <div className="max-h-72 overflow-auto p-2">
              {rows.map((r, i) => (
                <div key={i} className="mb-3 rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-[90px,1fr] items-center gap-2">
                      <Label className="text-xs">Medicine :</Label>
                      <MedicineCombobox
                        meds={data.medicines}
                        value={r.medicineId}
                        onChange={(v) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, medicineId: v, purchasePrice: data.medicines.find((m) => m.id === v)?.purchasePrice ?? x.purchasePrice } : x))}
                      />
                    </div>
                    <div className="grid grid-cols-[90px,1fr] items-center gap-2">
                      <Label className="text-xs">Qty :</Label>
                      <Input type="number" className="h-8" value={r.quantity || ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, quantity: +e.target.value || 1 } : x))} />
                    </div>
                    <div className="grid grid-cols-[90px,1fr] items-center gap-2">
                      <Label className="text-xs">Price :</Label>
                      <Input type="number" className="h-8" value={r.purchasePrice || ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, purchasePrice: +e.target.value || 0 } : x))} />
                    </div>
                    <div className="grid grid-cols-[90px,1fr] items-center gap-2">
                      <Label className="text-xs">Batch :</Label>
                      <Input className="h-8" value={r.batchNumber ?? ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, batchNumber: e.target.value } : x))} />
                    </div>
                    <div className="grid grid-cols-[90px,1fr] items-center gap-2">
                      <Label className="text-xs">Expiry :</Label>
                      <Input type="date" className="h-8" value={r.expiryDate ?? ""} onChange={(e) => setRows((rs) => rs.map((x, k) => k === i ? { ...x, expiryDate: e.target.value } : x))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (rows.length === 0) { toast.error("Add at least one item"); return; }
            onSave(supplier, invoice, rows);
          }}>Save & restock</Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MedicineCombobox({ meds, value, onChange }: {
  meds: Medicine[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => meds.find((m) => m.id === value), [meds, value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-8 w-full justify-between text-left font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : "Select medicine…"}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search medicine, barcode…" />
          <CommandList>
            <CommandEmpty>No medicine found.</CommandEmpty>
            <CommandGroup>
              {meds.map((m) => (
                <CommandItem key={m.id} value={`${m.name} ${m.barcode ?? ""} ${m.genericName ?? ""}`} onSelect={() => { onChange(m.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{m.name}</div>
                    {(m.barcode || m.genericName) && <div className="truncate text-[11px] text-muted-foreground">{m.barcode || m.genericName}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
