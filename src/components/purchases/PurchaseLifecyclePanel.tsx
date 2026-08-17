import { useMemo, useState } from "react";
import { ClipboardList, CreditCard, PackageCheck, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { syncInventoryBatches } from "@/lib/inventory-engine";
import type { GoodsReceipt, PurchaseInvoice, PurchaseOrder, PurchaseOrderLine, SupplierPayment } from "@/domain/schema";

const blankLine = (medicineId: string): PurchaseOrderLine => ({ medicineId, quantityOrdered: 1, unitCost: 0, bonusQuantity: 0 });

export function PurchaseLifecyclePanel() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const [tab, setTab] = useState<"orders" | "receiving" | "invoices" | "payments">("orders");
  const [supplierId, setSupplierId] = useState(data.suppliers[0]?.id ?? "");
  const [lines, setLines] = useState<PurchaseOrderLine[]>(data.medicines[0] ? [blankLine(data.medicines[0].id)] : []);
  const [notes, setNotes] = useState("");
  const [selectedPo, setSelectedPo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedGrns, setSelectedGrns] = useState<string[]>([]);
  const [paymentInvoice, setPaymentInvoice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SupplierPayment["method"]>("cash");

  const orders = data.settings.purchaseOrders ?? [];
  const grns = data.settings.goodsReceipts ?? [];
  const invoices = data.settings.purchaseInvoices ?? [];
  const payments = data.settings.supplierPayments ?? [];
  const openOrders = orders.filter((o) => o.status === "ordered" || o.status === "partial");
  const postedGrns = grns.filter((g) => g.status === "posted");
  const selectedInvoice = invoices.find((i) => i.id === paymentInvoice);

  const total = useMemo(() => lines.reduce((s, l) => s + Math.max(0, l.quantityOrdered) * Math.max(0, l.unitCost), 0), [lines]);

  function addLine() {
    if (!data.medicines[0]) return toast.error("Add a medicine first");
    setLines((v) => [...v, blankLine(data.medicines[0].id)]);
  }

  function createOrder() {
    if (!supplierId) return toast.error("Select a supplier");
    if (!lines.length || lines.some((l) => !l.medicineId || l.quantityOrdered <= 0)) return toast.error("Add valid order lines");
    const po: PurchaseOrder = { id: uid("po_"), supplierId, poNumber: `PO-${Date.now().toString(36).toUpperCase()}`, date: new Date().toISOString(), status: "ordered", lines: structuredClone(lines), notes: notes.trim() || undefined };
    mutate((d) => { d.settings.purchaseOrders ??= []; d.settings.purchaseOrders.push(po); });
    toast.success(`${po.poNumber} created`);
    setNotes(""); setLines(data.medicines[0] ? [blankLine(data.medicines[0].id)] : []);
  }

  function postGrn() {
    const po = orders.find((o) => o.id === selectedPo);
    if (!po) return toast.error("Select a purchase order");
    const receiptLines = po.lines.map((line) => {
      const med = data.medicines.find((m) => m.id === line.medicineId);
      return { medicineId: line.medicineId, quantityReceived: line.quantityOrdered, bonusQuantity: line.bonusQuantity ?? 0, batchNumber: med?.batchNumber ?? `B-${Date.now().toString(36).toUpperCase()}`, expiryDate: med?.expiryDate ?? "", unitCost: line.unitCost };
    });
    if (receiptLines.some((l) => !l.batchNumber || !l.expiryDate)) return toast.error("Every received line needs a batch and expiry date");
    const grn: GoodsReceipt = { id: uid("grn_"), supplierId: po.supplierId, purchaseOrderId: po.id, grnNumber: `GRN-${Date.now().toString(36).toUpperCase()}`, receivedAt: new Date().toISOString(), status: "posted", lines: receiptLines };
    mutate((d) => {
      d.settings.goodsReceipts ??= [];
      d.settings.goodsReceipts.push(grn);
      d.settings.inventoryBatches ??= [];
      for (const line of grn.lines) {
        const batch = { id: uid("batch_"), sourceKey: `grn:${grn.id}:${line.medicineId}:${line.batchNumber}`, purchaseId: undefined, purchaseItemIndex: undefined, medicineId: line.medicineId, batchNumber: line.batchNumber, barcode: d.medicines.find((m) => m.id === line.medicineId)?.barcode, quantity: line.quantityReceived + (line.bonusQuantity ?? 0), initialQuantity: line.quantityReceived + (line.bonusQuantity ?? 0), purchasePrice: line.unitCost, expiryDate: line.expiryDate, receivedDate: grn.receivedAt };
        d.settings.inventoryBatches.push(batch);
      }
      const target = d.settings.purchaseOrders?.find((o) => o.id === po.id);
      if (target) target.status = "received";
      syncInventoryBatches(d);
    });
    toast.success(`${grn.grnNumber} posted · stock received`);
    setSelectedPo(""); setTab("invoices");
  }

  function createInvoice() {
    if (!supplierId) return toast.error("Select a supplier");
    if (!invoiceNo.trim()) return toast.error("Supplier invoice number is required");
    const selected = postedGrns.filter((g) => selectedGrns.includes(g.id) && g.supplierId === supplierId);
    if (!selected.length) return toast.error("Select at least one posted GRN");
    const subtotal = selected.reduce((sum, g) => sum + g.lines.reduce((s, l) => s + l.quantityReceived * l.unitCost, 0), 0);
    const invoice: PurchaseInvoice = { id: uid("pinv_"), supplierId, invoiceNumber: invoiceNo.trim(), invoiceDate: new Date().toISOString(), dueDate: dueDate || undefined, purchaseOrderId: selected[0].purchaseOrderId, goodsReceiptIds: selected.map((g) => g.id), subtotal, discount: 0, tax: 0, total: subtotal, paid: 0, balance: subtotal, status: "unpaid" };
    mutate((d) => {
      d.settings.purchaseInvoices ??= [];
      d.settings.purchaseInvoices.push(invoice);
      d.settings.supplierLedger ??= [];
      d.settings.supplierLedger.push({ id: uid("sled_"), supplierId, date: invoice.invoiceDate, type: "purchase", amount: invoice.total, reference: invoice.invoiceNumber, note: `Purchase invoice from ${selected.length} GRN${selected.length === 1 ? "" : "s"}` });
      const supplier = d.suppliers.find((s) => s.id === supplierId); if (supplier) supplier.balance += invoice.total;
    });
    toast.success(`Invoice ${invoice.invoiceNumber} posted · payable ${money(invoice.total, sym)}`);
    setInvoiceNo(""); setDueDate(""); setSelectedGrns([]); setTab("payments");
  }

  function recordPayment() {
    if (!selectedInvoice) return toast.error("Select an invoice");
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid payment amount");
    if (amount > selectedInvoice.balance + 0.005) return toast.error("Payment exceeds the invoice balance");
    const payment: SupplierPayment = { id: uid("spay_"), supplierId: selectedInvoice.supplierId, paidAt: new Date().toISOString(), amount, method: paymentMethod, allocations: [{ invoiceId: selectedInvoice.id, amount }] };
    mutate((d) => {
      d.settings.supplierPayments ??= [];
      d.settings.supplierPayments.push(payment);
      const inv = d.settings.purchaseInvoices?.find((i) => i.id === selectedInvoice.id);
      if (inv) { inv.paid = Number((inv.paid + amount).toFixed(2)); inv.balance = Math.max(0, Number((inv.total - inv.paid).toFixed(2))); inv.status = inv.balance <= 0.005 ? "paid" : "partial"; }
      d.settings.supplierLedger ??= [];
      d.settings.supplierLedger.push({ id: uid("sled_"), supplierId: selectedInvoice.supplierId, date: payment.paidAt, type: "payment", amount: -amount, reference: selectedInvoice.invoiceNumber, note: `Supplier payment via ${payment.method}` });
      const supplier = d.suppliers.find((s) => s.id === selectedInvoice.supplierId); if (supplier) supplier.balance = Math.max(0, supplier.balance - amount);
    });
    toast.success(`Payment recorded · ${money(amount, sym)}`);
    setPaymentAmount("");
  }

  const tabs = [
    ["orders", "Purchase Orders", ClipboardList],
    ["receiving", "GRN / Receive", PackageCheck],
    ["invoices", "Supplier Invoices", ReceiptText],
    ["payments", "Supplier Payments", CreditCard],
  ] as const;

  return <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
    <div className="mb-4 flex flex-wrap items-center gap-2"><div><h2 className="text-lg font-semibold">Purchase lifecycle</h2><p className="text-xs text-muted-foreground">PO → Goods Received → Supplier Invoice → Payable</p></div><div className="ml-auto flex flex-wrap gap-1">{tabs.map(([id, label, Icon]) => <Button key={id} size="sm" variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}><Icon className="mr-1.5 h-4 w-4" />{label}</Button>)}</div></div>

    {tab === "orders" && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><div><Label className="text-xs">Supplier</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{data.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-2"><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional order notes" /></div></div><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="w-28">Qty</TableHead><TableHead className="w-32">Cost</TableHead><TableHead className="w-28">Bonus</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{lines.map((line, i) => <TableRow key={i}><TableCell><Select value={line.medicineId} onValueChange={(v) => setLines((xs) => xs.map((x, k) => k === i ? { ...x, medicineId: v, unitCost: data.medicines.find((m) => m.id === v)?.purchasePrice ?? x.unitCost } : x))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{data.medicines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Input type="number" min="1" className="h-8" value={line.quantityOrdered} onChange={(e) => setLines((xs) => xs.map((x,k)=>k===i?{...x,quantityOrdered:Math.max(1,Number(e.target.value)||1)}:x))} /></TableCell><TableCell><Input type="number" min="0" step="0.01" className="h-8" value={line.unitCost} onChange={(e) => setLines((xs) => xs.map((x,k)=>k===i?{...x,unitCost:Math.max(0,Number(e.target.value)||0)}:x))} /></TableCell><TableCell><Input type="number" min="0" className="h-8" value={line.bonusQuantity ?? 0} onChange={(e) => setLines((xs) => xs.map((x,k)=>k===i?{...x,bonusQuantity:Math.max(0,Number(e.target.value)||0)}:x))} /></TableCell><TableCell><Button size="icon" variant="ghost" disabled={lines.length===1} onClick={()=>setLines((xs)=>xs.filter((_,k)=>k!==i))}>×</Button></TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={addLine}><Plus className="mr-1 h-4 w-4" />Add line</Button><span className="ml-auto text-sm font-semibold">Order value: {money(total, sym)}</span><Button onClick={createOrder}>Create purchase order</Button></div><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{orders.slice().reverse().slice(0,8).map((o)=><TableRow key={o.id}><TableCell className="font-mono text-xs">{o.poNumber}</TableCell><TableCell>{data.suppliers.find(s=>s.id===o.supplierId)?.name ?? "—"}</TableCell><TableCell>{o.date.slice(0,10)}</TableCell><TableCell>{o.status}</TableCell></TableRow>)}</TableBody></Table></div></div>}

    {tab === "receiving" && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><div><Label className="text-xs">Open PO</Label><Select value={selectedPo} onValueChange={setSelectedPo}><SelectTrigger className="h-9"><SelectValue placeholder="Select purchase order" /></SelectTrigger><SelectContent>{openOrders.map((o)=><SelectItem key={o.id} value={o.id}>{o.poNumber} · {data.suppliers.find(s=>s.id===o.supplierId)?.name ?? "Supplier"}</SelectItem>)}</SelectContent></Select></div><div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">Receiving creates real batch inventory. Batch and expiry are taken from the medicine master for this first receiving flow; the dedicated batch/expiry receiving editor will be expanded in Part 2.</div></div><Button onClick={postGrn} disabled={!selectedPo}>Post GRN / Receive goods</Button><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>GRN</TableHead><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{grns.slice().reverse().slice(0,8).map((g)=><TableRow key={g.id}><TableCell className="font-mono text-xs">{g.grnNumber}</TableCell><TableCell>{orders.find(o=>o.id===g.purchaseOrderId)?.poNumber ?? "—"}</TableCell><TableCell>{data.suppliers.find(s=>s.id===g.supplierId)?.name ?? "—"}</TableCell><TableCell>{g.receivedAt.slice(0,10)}</TableCell><TableCell>{g.status}</TableCell></TableRow>)}</TableBody></Table></div></div>}

    {tab === "invoices" && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><div><Label className="text-xs">Supplier</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{data.suppliers.map((s)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Supplier invoice #</Label><Input value={invoiceNo} onChange={(e)=>setInvoiceNo(e.target.value)} placeholder="INV-12345" /></div><div><Label className="text-xs">Due date</Label><Input type="date" value={dueDate} onChange={(e)=>setDueDate(e.target.value)} /></div><div className="flex items-end"><Button className="w-full" onClick={createInvoice}>Post supplier invoice</Button></div></div><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>GRN</TableHead><TableHead>Supplier</TableHead><TableHead>Value</TableHead><TableHead>Select</TableHead></TableRow></TableHeader><TableBody>{postedGrns.filter(g=>g.supplierId===supplierId).map(g=>{const value=g.lines.reduce((s,l)=>s+l.quantityReceived*l.unitCost,0);return <TableRow key={g.id}><TableCell className="font-mono text-xs">{g.grnNumber}</TableCell><TableCell>{data.suppliers.find(s=>s.id===g.supplierId)?.name ?? "—"}</TableCell><TableCell>{money(value,sym)}</TableCell><TableCell><input type="checkbox" checked={selectedGrns.includes(g.id)} onChange={(e)=>setSelectedGrns((xs)=>e.target.checked?[...xs,g.id]:xs.filter(x=>x!==g.id))}/></TableCell></TableRow>})}</TableBody></Table></div><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{invoices.slice().reverse().map(i=><TableRow key={i.id}><TableCell>{i.invoiceNumber}</TableCell><TableCell>{data.suppliers.find(s=>s.id===i.supplierId)?.name ?? "—"}</TableCell><TableCell>{money(i.total,sym)}</TableCell><TableCell>{money(i.paid,sym)}</TableCell><TableCell className="font-semibold">{money(i.balance,sym)}</TableCell><TableCell>{i.status}</TableCell></TableRow>)}</TableBody></Table></div></div>}

    {tab === "payments" && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><div><Label className="text-xs">Invoice</Label><Select value={paymentInvoice} onValueChange={setPaymentInvoice}><SelectTrigger className="h-9"><SelectValue placeholder="Select unpaid invoice" /></SelectTrigger><SelectContent>{invoices.filter(i=>i.balance>0.005&&i.status!=="cancelled").map(i=><SelectItem key={i.id} value={i.id}>{i.invoiceNumber} · {money(i.balance,sym)} due</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Amount</Label><Input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e)=>setPaymentAmount(e.target.value)} /></div><div><Label className="text-xs">Method</Label><Select value={paymentMethod} onValueChange={(v)=>setPaymentMethod(v as SupplierPayment["method"])}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{["cash","card","bank","online","other"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button className="w-full" onClick={recordPayment}>Record payment</Button></div></div><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Invoice</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead></TableRow></TableHeader><TableBody>{payments.slice().reverse().map(p=>{const inv=invoices.find(i=>i.id===p.allocations[0]?.invoiceId);return <TableRow key={p.id}><TableCell>{p.paidAt.slice(0,10)}</TableCell><TableCell>{data.suppliers.find(s=>s.id===p.supplierId)?.name ?? "—"}</TableCell><TableCell>{inv?.invoiceNumber ?? "—"}</TableCell><TableCell>{money(p.amount,sym)}</TableCell><TableCell>{p.method}</TableCell></TableRow>})}</TableBody></Table></div></div>}
  </section>;
}
