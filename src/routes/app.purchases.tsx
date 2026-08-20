import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, Plus, Trash2, Check, ChevronsUpDown, Search, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { pinContext } from "@/lib/pins";
import { useQuickAction } from "@/lib/quick-actions";
import { cn } from "@/lib/utils";
import type { Purchase, PurchaseItem, Medicine } from "@/domain/schema";
import { canAddPurchase, canEditPurchase, canDeletePurchase } from "@/lib/granular-permissions";
import { PurchaseLifecyclePanel } from "@/components/purchases/PurchaseLifecyclePanel";

export const Route = createFileRoute("/app/purchases")({
  component: () => <PermissionGate perm="purchases"><PurchasesPage /></PermissionGate>,
});

function printPurchase(p: Purchase, data: ReturnType<typeof useProjectStore.getState>["data"]) {
  const supplier = data.suppliers.find((s) => s.id === p.supplierId)?.name ?? "Untagged";
  const rows = p.items.map((it) => {
    const m = data.medicines.find((x) => x.id === it.medicineId);
    return `<tr><td>${escapeHtml(m?.name ?? it.medicineId)}</td><td>${it.quantity}</td><td>${Number(it.purchasePrice).toFixed(2)}</td><td>${(it.quantity * it.purchasePrice).toFixed(2)}</td></tr>`;
  }).join("");
  const total = p.items.reduce((sum, it) => sum + it.quantity * it.purchasePrice, 0);
  const win = window.open("", "_blank", "width=800,height=700");
  if (!win) { toast.error("Popup blocked. Allow popups to print the purchase."); return; }
  win.document.write(`<!doctype html><html><head><title>Purchase ${escapeHtml(p.invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}td:nth-child(2),td:nth-child(3),td:nth-child(4),th:nth-child(2),th:nth-child(3),th:nth-child(4){text-align:right}.total{text-align:right;font-weight:bold;margin-top:16px}</style></head><body><h1>Purchase Invoice</h1><p><b>Invoice:</b> ${escapeHtml(p.invoiceNumber)}<br><b>Supplier:</b> ${escapeHtml(supplier)}<br><b>Date:</b> ${escapeHtml(p.purchaseDate.slice(0,10))}</p><table><thead><tr><th>Medicine</th><th>Qty</th><th>Purchase Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: ${escapeHtml(data.settings.currencySymbol)}${total.toFixed(2)}</p><script>window.onload=()=>window.print();</script></body></html>`);
  win.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] ?? c));
}

function PurchasesPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const user = useSession((s) => s.user);
  const canAdd = canAddPurchase(user);
  const canEdit = canEditPurchase(user);
  const canDelete = canDeletePurchase(user);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [q, setQ] = useState("");
  const [purchaseTab, setPurchaseTab] = useState("simple");
  useQuickAction("new-purchase", () => { if (canAdd) setOpen(true); });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data.purchases;
    return data.purchases.filter((p) => p.invoiceNumber.toLowerCase().includes(needle));
  }, [data.purchases, q]);

  function savePurchase(supplierId: string, invoice: string, items: PurchaseItem[], printAfterSave: boolean, existingId?: string) {
    let saved: Purchase | null = null;
    mutate((d) => {
      if (existingId) {
        const old = d.purchases.find((p) => p.id === existingId);
        if (!old) return;
        for (const it of old.items) {
          const m = d.medicines.find((x) => x.id === it.medicineId);
          if (m) m.stockQuantity = Math.max(0, m.stockQuantity - it.quantity);
        }
        saved = { ...old, supplierId, invoiceNumber: invoice.trim(), items };
        for (const it of items) {
          const m = d.medicines.find((x) => x.id === it.medicineId);
          if (m) { m.stockQuantity += it.quantity; if (it.batchNumber) m.batchNumber = it.batchNumber; if (it.expiryDate) m.expiryDate = it.expiryDate; m.purchasePrice = it.purchasePrice; }
        }
        const idx = d.purchases.findIndex((p) => p.id === existingId);
        if (idx >= 0) d.purchases[idx] = saved;
      } else {
        saved = { id: uid("pur_"), supplierId, invoiceNumber: invoice.trim(), purchaseDate: new Date().toISOString(), items, taxPercent: 0, discount: 0 };
        for (const it of items) {
          const m = d.medicines.find((x) => x.id === it.medicineId);
          if (m) { m.stockQuantity += it.quantity; if (it.batchNumber) m.batchNumber = it.batchNumber; if (it.expiryDate) m.expiryDate = it.expiryDate; m.purchasePrice = it.purchasePrice; }
        }
        d.purchases.push(saved);
      }
    });
    if (!saved) { toast.error("Purchase could not be saved"); return; }
    toast.success(existingId ? "Purchase updated · stock adjusted" : "Purchase recorded · stock updated");
    if (printAfterSave) printPurchase(saved, useProjectStore.getState().data!);
    setOpen(false); setEditing(null);
  }

  function removePurchase(p: Purchase) {
    if (!canDelete) return;
    if (!window.confirm(`Delete purchase ${p.invoiceNumber}? Its stock will be reversed.`)) return;
    mutate((d) => {
      for (const it of p.items) {
        const m = d.medicines.find((x) => x.id === it.medicineId);
        if (m) m.stockQuantity = Math.max(0, m.stockQuantity - it.quantity);
      }
      d.purchases = d.purchases.filter((x) => x.id !== p.id);
    });
    toast.success("Purchase deleted · stock reversed");
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Truck className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Purchases</h1><p className="text-sm text-muted-foreground">{data.purchases.length} purchase{data.purchases.length === 1 ? "" : "s"}</p></div>
        <div className="relative ml-auto"><Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice number…" className="h-9 w-64 pl-8" data-search /></div>
        {canAdd && <Button {...pinContext({ id: "action:new-purchase", label: "New purchase", kind: "action", to: "/app/purchases" })} onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New purchase</Button>}
      </header>

      <Tabs value={purchaseTab} onValueChange={setPurchaseTab} className="w-full">
        <TabsList className="mb-5 grid w-full max-w-xl grid-cols-2">
          <TabsTrigger value="simple">Simple Purchase</TabsTrigger>
          <TabsTrigger value="lifecycle">Purchase Cycle</TabsTrigger>
        </TabsList>
        <TabsContent value="simple" className="mt-0">
      <div className="surface-card overflow-hidden">
        <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-28"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">No purchases found.</TableCell></TableRow>}
            {filtered.map((p) => { const total = p.items.reduce((s, i) => s + i.quantity * i.purchasePrice, 0); const sup = data.suppliers.find((s) => s.id === p.supplierId); return <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell><TableCell>{sup?.name ?? <span className="text-muted-foreground">Untagged</span>}</TableCell><TableCell>{p.purchaseDate.slice(0,10)}</TableCell><TableCell className="text-right tabular-nums">{p.items.length}</TableCell><TableCell className="text-right tabular-nums">{money(total, sym)}</TableCell>
              <TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Reprint" onClick={() => printPurchase(p, data)}><Printer className="h-4 w-4" /></Button>{canEdit && <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>}{canDelete && <Button size="icon" variant="ghost" title="Delete" onClick={() => removePurchase(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></TableCell>
            </TableRow>; })}
          </TableBody>
        </Table>
      </div>
        </TabsContent>
        <TabsContent value="lifecycle" className="mt-0">
          <PurchaseLifecyclePanel />
        </TabsContent>
      </Tabs>

      {(open || editing) && <NewPurchase existing={editing ?? undefined} onClose={() => { setOpen(false); setEditing(null); }} onSave={(supplierId, invoice, items, printAfterSave, id) => savePurchase(supplierId, invoice, items, printAfterSave, id)} />}
    </div>
  );
}

function NewPurchase({ existing, onClose, onSave }: {
  existing?: Purchase;
  onClose: () => void;
  onSave: (supplierId: string, invoice: string, items: PurchaseItem[], printAfterSave: boolean, existingId?: string) => void;
}) {
  const data = useProjectStore((s) => s.data!);
  const [supplier, setSupplier] = useState(existing?.supplierId ?? "");
  const [invoice, setInvoice] = useState(existing?.invoiceNumber ?? `PUR-${Date.now().toString(36).toUpperCase()}`);
  const [rows, setRows] = useState<PurchaseItem[]>(existing?.items ?? []);
  const [printAfterSave, setPrintAfterSave] = useState(true);

  function addRow() {
    if (!data.medicines[0]) { toast.error("Add a medicine first"); return; }
    setRows((r) => [...r, { medicineId: data.medicines[0].id, quantity: 1, purchasePrice: data.medicines[0].purchasePrice, batchNumber: "", expiryDate: "" }]);
  }

  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{existing ? "Edit purchase" : "New purchase"}</DialogTitle></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label className="text-xs">Supplier (optional)</Label><Select value={supplier || "__none"} onValueChange={(v) => setSupplier(v === "__none" ? "" : v)}><SelectTrigger className="h-9"><SelectValue placeholder="Untagged" /></SelectTrigger><SelectContent><SelectItem value="__none">Untagged (no supplier)</SelectItem>{data.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Invoice #</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div></div>
    <div className="mt-3 rounded-md border"><div className="flex items-center justify-between border-b p-2"><span className="text-xs font-medium text-muted-foreground">Line items</span><Button size="sm" variant="outline" onClick={addRow}><Plus className="mr-1 h-3 w-3" />Add</Button></div>{rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No items yet.</p> : <div className="max-h-72 overflow-auto p-2">{rows.map((r, i) => <div key={i} className="mb-3 rounded-md border p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Item {i+1}</span><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div><div className="grid gap-2">
      <div className="grid grid-cols-[90px,1fr] items-center gap-2"><Label className="text-xs">Medicine :</Label><MedicineCombobox meds={data.medicines} value={r.medicineId} onChange={(v) => setRows((rs) => rs.map((x,k) => k===i ? {...x, medicineId:v, purchasePrice:data.medicines.find((m)=>m.id===v)?.purchasePrice ?? x.purchasePrice} : x))} /></div>
      <div className="grid grid-cols-[90px,1fr] items-center gap-2"><Label className="text-xs">Qty :</Label><Input type="number" className="h-8" value={r.quantity || ""} onChange={(e)=>setRows((rs)=>rs.map((x,k)=>k===i?{...x,quantity:Math.max(1,+e.target.value||1)}:x))} /></div>
      <div className="grid grid-cols-[90px,1fr] items-center gap-2"><Label className="text-xs">Price :</Label><Input type="number" className="h-8" value={r.purchasePrice || ""} onChange={(e)=>setRows((rs)=>rs.map((x,k)=>k===i?{...x,purchasePrice:+e.target.value||0}:x))} /></div>
      <div className="grid grid-cols-[90px,1fr] items-center gap-2"><Label className="text-xs">Batch :</Label><Input className="h-8" value={r.batchNumber ?? ""} onChange={(e)=>setRows((rs)=>rs.map((x,k)=>k===i?{...x,batchNumber:e.target.value}:x))} /></div>
      <div className="grid grid-cols-[90px,1fr] items-center gap-2"><Label className="text-xs">Expiry :</Label><Input type="date" className="h-8" value={r.expiryDate ?? ""} onChange={(e)=>setRows((rs)=>rs.map((x,k)=>k===i?{...x,expiryDate:e.target.value}:x))} /></div>
    </div></div>)}</div>}</div>
    <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox checked={printAfterSave} onCheckedChange={(v)=>setPrintAfterSave(v===true)} /><span>Print purchase after saving</span></label>
    <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={()=>{if(!invoice.trim()){toast.error("Invoice number is required");return;}if(rows.length===0){toast.error("Add at least one item");return;}onSave(supplier,invoice,rows,printAfterSave,existing?.id);}}>{existing ? "Save changes" : "Save & restock"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function MedicineCombobox({ meds, value, onChange }: { meds: Medicine[]; value: string; onChange: (id: string) => void; }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => meds.find((m) => m.id === value), [meds, value]);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" className="h-8 w-full justify-between text-left font-normal"><span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : "Select medicine…"}</span><ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start"><Command><CommandInput placeholder="Search medicine, barcode…" /><CommandList><CommandEmpty>No medicine found.</CommandEmpty><CommandGroup>{meds.map((m)=><CommandItem key={m.id} value={`${m.name} ${m.barcode ?? ""} ${m.genericName ?? ""}`} onSelect={()=>{onChange(m.id);setOpen(false);}}><Check className={cn("mr-2 h-4 w-4",value===m.id?"opacity-100":"opacity-0")} /><div className="min-w-0 flex-1"><div className="truncate">{m.name}</div>{(m.barcode||m.genericName)&&<div className="truncate text-[11px] text-muted-foreground">{m.barcode||m.genericName}</div>}</div></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
