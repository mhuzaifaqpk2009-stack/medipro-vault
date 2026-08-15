import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart, Search, Trash2, Receipt, AlertTriangle, FileText, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/SearchInput";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { useCartStore } from "@/store/cart-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { nextInvoiceNumber, printReceipt } from "@/lib/receipt";
import { cartTotals } from "@/lib/sale-math";
import type { PaymentMethod, Sale } from "@/domain/schema";
import { PermissionGate } from "@/components/PermissionGate";
import { BARCODE_SCAN_EVENT } from "@/components/BarcodeScanner";
import { logSaleEvent } from "@/lib/audit-log";
import { canChangeCheckoutPrice, canForceSale, canLoadPrescription } from "@/lib/granular-permissions";
import { advancePrescriptionVisit, isPrescriptionDueSoon, isPrescriptionVisible, type Prescription } from "@/lib/prescriptions";

export const Route = createFileRoute("/app/sales")({
  component: () => <PermissionGate perm="sales"><SalesPage /></PermissionGate>,
});

function SalesPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const canLoadRx = canLoadPrescription(user);
  const canDiscount = isAdmin || !!user?.permissions.applyDiscount;
  const forcePermission = canForceSale(user);
  const canPriceByPermission = canChangeCheckoutPrice(user);
  const canChangePrice = isAdmin ? data.settings.allowCheckoutPriceChange !== false : canPriceByPermission;
  const maxDiscount = (user?.maxDiscount && user.maxDiscount > 0) ? user.maxDiscount : (data.settings.maxDiscount ?? 0);

  const cart = useCartStore((s) => s.cart);
  const setCart = useCartStore((s) => s.setCart);
  const customerId = useCartStore((s) => s.customerId);
  const setCustomerId = useCartStore((s) => s.setCustomerId);
  const remark = useCartStore((s) => s.remark);
  const setRemark = useCartStore((s) => s.setRemark);
  const discount = useCartStore((s) => s.discount);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const taxPercent = data.settings.taxPercent || 0;
  const method = useCartStore((s) => s.method);
  const setMethod = useCartStore((s) => s.setMethod);
  const received = useCartStore((s) => s.received);
  const setReceived = useCartStore((s) => s.setReceived);
  const printBill = useCartStore((s) => s.printBill);
  const setPrintBill = useCartStore((s) => s.setPrintBill);
  const reset = useCartStore((s) => s.reset);

  type SearchBy = "name" | "generic" | "company";
  const [q, setQ] = useState("");
  const [by, setBy] = useState<SearchBy>(data.settings.defaultSearchBy ?? "name");
  const [rxOpen, setRxOpen] = useState(false);
  const [rxSearch, setRxSearch] = useState("");

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const field = (m: (typeof data.medicines)[number]) => by === "generic" ? m.genericName : by === "company" ? m.company : m.name;
    const matches = data.medicines.filter((m) => (m.barcode ?? "").toLowerCase().includes(t) || (m.qrCode ?? "").toLowerCase().includes(t) || (field(m) ?? "").toLowerCase().includes(t));
    return matches.sort((a, b) => {
      const ac = (a.barcode ?? "").toLowerCase() === t || (a.qrCode ?? "").toLowerCase() === t;
      const bc = (b.barcode ?? "").toLowerCase() === t || (b.qrCode ?? "").toLowerCase() === t;
      return Number(bc) - Number(ac);
    }).slice(0, 8);
  }, [q, data.medicines, by]);

  const prescriptions = useMemo(() => {
    const t = rxSearch.trim().toLowerCase();
    return (data.settings.prescriptions ?? []).filter((p) => isPrescriptionVisible(p, user) && (!t || `${p.patientName} ${p.patientPhone ?? ""} ${p.doctorName ?? ""}`.toLowerCase().includes(t))).sort((a,b) => Number(isPrescriptionDueSoon(b)) - Number(isPrescriptionDueSoon(a)) || (b.date.localeCompare(a.date))).slice(0, 40);
  }, [data.settings.prescriptions, user, rxSearch]);

  function confirmForce(med: (typeof data.medicines)[number], quantity: number) {
    if (quantity <= med.stockQuantity) return true;
    if (!forcePermission) {
      toast.error(`Not enough stock. Available: ${med.stockQuantity}`);
      return false;
    }
    return window.confirm(`"${med.name}" has only ${med.stockQuantity} in stock, but you entered ${quantity}. Force sell ${quantity - med.stockQuantity} extra item(s)?`);
  }

  function add(medId: string) {
    const med = data.medicines.find((m) => m.id === medId);
    if (!med) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.medicineId === medId);
      const nextQty = i >= 0 ? c[i].quantity + 1 : 1;
      if (!confirmForce(med, nextQty)) return c;
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], quantity: nextQty, forced: nextQty > med.stockQuantity, forcedSale: nextQty > med.stockQuantity };
        return copy;
      }
      return [{ medicineId: medId, quantity: 1, salePrice: med.salePrice, discountPercent: 0, name: med.name, forced: 1 > med.stockQuantity, forcedSale: 1 > med.stockQuantity }, ...c];
    });
    setQ("");
  }

  const addScannedCode = useCallback((code: string) => {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return;
    const med = data.medicines.find((m) => (m.barcode ?? "").trim().toLowerCase() === normalized || (m.qrCode ?? "").trim().toLowerCase() === normalized);
    if (!med) {
      setQ(code);
      toast.error(`No medicine found for code ${code}`);
      return;
    }
    add(med.id);
  }, [data.medicines, cart]);

  useEffect(() => {
    const onScan = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: string }>).detail;
      if (detail?.value) addScannedCode(detail.value);
    };
    window.addEventListener(BARCODE_SCAN_EVENT, onScan);
    return () => window.removeEventListener(BARCODE_SCAN_EVENT, onScan);
  }, [addScannedCode]);

  function loadPrescription(p: Prescription) {
    if (!canLoadRx) return toast.error("You do not have permission to load prescriptions");
    setCart((current) => {
      const next = [...current];
      for (const line of p.items) {
        const med = data.medicines.find((m) => m.id === line.medicineId);
        if (!med) continue;
        const qty = Math.max(1, line.quantity || 1);
        const i = next.findIndex((x) => x.medicineId === med.id);
        if (i >= 0) next[i] = { ...next[i], quantity: next[i].quantity + qty };
        else next.push({ medicineId: med.id, quantity: qty, salePrice: med.salePrice, discountPercent: 0, name: med.name, forced: false, forcedSale: false });
      }
      return next;
    });
    if (p.nextVisitDate) mutate((d) => { const target = (d.settings.prescriptions ?? []).find((x) => x.id === p.id); if (target) target.nextVisitDate = advancePrescriptionVisit(target); });
    setCustomerId("");
    setRxOpen(false);
    toast.success(`${p.patientName}'s prescription loaded into the cart`);
  }

  function setQuantity(i: number, value: number) {
    const clean = Math.max(1, Math.floor(value || 1));
    const line = cart[i];
    if (!line) return;
    const med = data.medicines.find((m) => m.id === line.medicineId);
    if (!med) return;
    if (!confirmForce(med, clean)) return;
    setCart((c) => c.map((l, idx) => idx === i ? { ...l, quantity: clean, forced: clean > med.stockQuantity, forcedSale: clean > med.stockQuantity } : l));
  }

  function updLine(i: number, patch: Partial<typeof cart[number]>) {
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const { subtotal, tax: taxAmt, discountValue, total } = cartTotals(cart, taxPercent, discount);
  const change = Math.max(0, received - total);
  const specialPercent = customerId ? (data.customers.find((c) => c.id === customerId)?.specialDiscountPercent ?? 0) : 0;

  useEffect(() => {
    if (!specialPercent) return;
    setDiscount(specialPercent);
  }, [specialPercent, setDiscount]);

  function handleDiscountChange(v: number) {
    const clean = Math.min(100, Math.max(0, v || 0));
    if (!isAdmin && maxDiscount > 0 && clean > maxDiscount) {
      toast.error(`Max discount is ${maxDiscount}%`);
      setDiscount(maxDiscount);
      return;
    }
    setDiscount(clean);
  }

  function validateStockBeforeCheckout() {
    for (const line of cart) {
      const med = data.medicines.find((m) => m.id === line.medicineId);
      if (!med) { toast.error(`Medicine no longer exists: ${line.name}`); return false; }
      if (line.quantity > med.stockQuantity && !forcePermission) { toast.error(`${med.name}: only ${med.stockQuantity} in stock. Force Sale permission is required.`); return false; }
      if (line.quantity > med.stockQuantity && !line.forcedSale) {
        const ok = window.confirm(`"${med.name}" is below requested stock. Force sell ${line.quantity - med.stockQuantity} extra item(s)?`);
        if (!ok) return false;
        setCart((c) => c.map((x) => x.medicineId === line.medicineId ? { ...x, forced: true, forcedSale: true } : x));
      }
    }
    return true;
  }

  function checkout() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!validateStockBeforeCheckout()) return;
    const invoiceNumber = nextInvoiceNumber(data);
    const newSale: Sale = {
      id: uid("sale_"), invoiceNumber, date: new Date().toISOString(), customerId: customerId || undefined, remark: remark.trim() || undefined,
      items: cart.map(({ name: _n, forced, ...rest }) => ({ ...rest, forcedSale: forced === true || rest.forcedSale === true, costPriceAtSale: data.medicines.find((m) => m.id === rest.medicineId)?.purchasePrice ?? 0 })),
      discount: canDiscount ? discount : 0, taxPercent, payments: [{ method: method === "mixed" ? "cash" : method, amount: total }], status: "completed", createdBy: user?.username,
    };
    mutate((d) => {
      for (const line of cart) { const m = d.medicines.find((x) => x.id === line.medicineId); if (m) m.stockQuantity = Math.max(0, m.stockQuantity - line.quantity); }
      if (customerId) { const c = d.customers.find((x) => x.id === customerId); if (c) c.loyaltyPoints = (c.loyaltyPoints ?? 0) + Math.floor(total); }
      d.sales.push(newSale); d.settings.invoiceCounter = Number(invoiceNumber) + 1;
    }, { history: false });
    void logSaleEvent(newSale.id, total, user?.username, user?.id);
    toast.success(`Sale complete · ${invoiceNumber}`);
    if (newSale.items.some((x) => x.forcedSale) && data.settings.notifyOnForceSale !== false && isAdmin) toast.warning("This sale contains a forced-sale item");
    if (printBill) printReceipt(newSale, useProjectStore.getState().data!);
    reset();
  }

  const hasForced = cart.some((l) => l.forced || l.forcedSale);

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr,380px]">
      <div className="surface-card flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b p-4">
          <ShoppingCart className="h-5 w-5 text-primary" /><h1 className="font-display text-lg font-semibold">Point of Sale</h1>
          {hasForced && <span className="ml-auto flex items-center gap-1 rounded bg-warning/15 px-2 py-1 text-[11px] font-medium text-warning"><AlertTriangle className="h-3 w-3" /> Contains force-sold items</span>}
        </div>
        <div className="relative border-b p-3">
          <div className="flex items-center gap-1.5">
            <Select value={by} onValueChange={(v) => setBy(v as SearchBy)}><SelectTrigger className="h-11 w-[104px] shrink-0 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="generic">Generic</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select>
            <div className="relative flex-1"><Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><SearchInput data-search phrases={["Scan barcode or QR code or search medicine…", "Enter adds the top match…"]} value={q} autoFocus onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && results[0]) add(results[0].id); }} className="h-11 pl-8 text-sm" /></div>
            {canLoadRx && <Button type="button" variant="outline" className="h-11 shrink-0" title="Load prescription" onClick={() => { setRxSearch(""); setRxOpen(true); }}><FileText className="mr-1.5 h-4 w-4" />Prescription</Button>}
          </div>
          {results.length > 0 && <div className="absolute left-3 right-3 top-14 z-10 max-h-72 overflow-auto rounded-md border bg-popover shadow-elevated">{results.map((m) => <button key={m.id} onClick={() => add(m.id)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"><span><span className="font-medium">{m.name}</span><span className="ml-2 text-xs text-muted-foreground">{m.barcode || m.qrCode || m.genericName || ""}</span></span><span className={`text-xs ${m.stockQuantity <= 0 ? "text-destructive" : "text-muted-foreground"}`}>Stock {m.stockQuantity} · {money(m.salePrice, sym)}</span></button>)}</div>}
        </div>
        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? <div className="grid place-items-center py-24 text-sm text-muted-foreground">Cart is empty — scan, search or load a prescription to begin.</div> : <table className="w-full text-sm"><thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="p-2 text-left">Item</th><th className="p-2 text-right w-20">Qty</th><th className="p-2 text-right w-24">Price</th><th className="p-2 text-right w-28">Line</th><th className="w-10"></th></tr></thead><tbody>{cart.map((l, i) => <tr key={l.medicineId} className="border-b last:border-0"><td className="p-2">{l.name}{(l.forced || l.forcedSale) && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">FORCED</span>}</td><td className="p-2"><Input type="number" min={1} className="h-8 text-right" value={l.quantity || ""} onChange={(e) => setQuantity(i, +e.target.value)} /></td><td className="p-2"><Input type="number" min={0} step="0.01" disabled={!canChangePrice} title={!canChangePrice ? "You do not have permission to change the checkout price" : "Change price for this sale only"} className="h-8 text-right" value={l.salePrice || ""} onChange={(e) => updLine(i, { salePrice: +e.target.value || 0 })} /></td><td className="p-2 text-right tabular-nums">{money(l.salePrice * l.quantity, sym)}</td><td className="p-2 text-right"><Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>)}</tbody></table>}
        </div>
      </div>
      <aside className="surface-card flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Receipt className="h-4 w-4" /> Checkout</h2>
        <div><Label className="text-xs">Customer (optional)</Label><Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}><SelectTrigger className="h-9"><SelectValue placeholder="Walk-in customer" /></SelectTrigger><SelectContent><SelectItem value="none">Walk-in customer</SelectItem>{data.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Remark (optional)</Label><Input value={remark} placeholder="e.g. MUZAMMIL SB" onChange={(e) => setRemark(e.target.value)} /></div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm"><Row k="Subtotal" v={money(subtotal, sym)} /><div className="mt-2"><Row k={`Tax (${taxPercent}%)`} v={money(taxAmt, sym)} /></div><div className="mt-3 flex items-center gap-3"><Label className="w-20 shrink-0 whitespace-nowrap text-xs">Discount %</Label><Input type="number" max={100} className="h-8 flex-1" placeholder="0" disabled={!canDiscount} value={discount || ""} onChange={(e) => handleDiscountChange(+e.target.value)} /><span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">−{money(discountValue, sym)}</span></div>{specialPercent > 0 && <p className="mt-1 text-[11px] text-primary">Customer special discount {specialPercent}% applied automatically.</p>}{!isAdmin && maxDiscount > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Max discount: {maxDiscount}%</p>}<div className="mt-3 flex items-center justify-between border-t pt-2"><span className="font-display font-semibold">Total</span><span className="font-display text-xl font-bold tabular-nums">{money(total, sym)}</span></div></div>
        <div><Label className="text-xs">Payment method</Label><Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent></Select></div>
        {method === "cash" && <><div><Label className="text-xs">Cash received (optional)</Label><Input type="number" value={received || ""} onChange={(e) => setReceived(+e.target.value || 0)} /></div><Row k="Change" v={money(change, sym)} /></>}
        <label className="mt-auto flex items-center gap-2 text-sm"><Checkbox checked={printBill} onCheckedChange={(v) => setPrintBill(v === true)} /><span>Print bill</span></label><Button size="lg" onClick={checkout} disabled={cart.length === 0}>Complete sale</Button>
      </aside>
      <Dialog open={rxOpen} onOpenChange={setRxOpen}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Load prescription</DialogTitle></DialogHeader><Input autoFocus placeholder="Search patient, phone or doctor" value={rxSearch} onChange={(e) => setRxSearch(e.target.value)} /><div className="mt-3 space-y-2">{prescriptions.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No accessible prescriptions found.</p> : prescriptions.map((p) => <button key={p.id} onClick={() => loadPrescription(p)} className="w-full rounded-lg border p-3 text-left hover:bg-muted"><div className="flex items-center justify-between gap-3"><div><b>{p.patientName}</b><p className="text-xs text-muted-foreground">{p.patientPhone ?? "No phone"}{p.doctorName ? ` · Dr. ${p.doctorName}` : ""}</p></div>{isPrescriptionDueSoon(p) && <BellRing className="h-4 w-4 text-warning" />}</div><div className="mt-2 text-xs text-muted-foreground">{p.items.map((x) => data.medicines.find((m) => m.id === x.medicineId)?.name ?? "Missing medicine").join(" · ")}{p.nextVisitDate ? ` · Next visit ${p.nextVisitDate}` : ""}</div></button>)}</div><DialogFooter><Button variant="ghost" onClick={() => setRxOpen(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>; }
