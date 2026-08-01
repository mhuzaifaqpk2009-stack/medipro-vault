import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingCart, Search, Trash2, Receipt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { useCartStore } from "@/store/cart-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { nextInvoiceNumber, printReceipt } from "@/lib/receipt";
import type { PaymentMethod, Sale } from "@/domain/schema";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/app/sales")({
  component: () => <PermissionGate perm="sales"><SalesPage /></PermissionGate>,
});

function SalesPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const canDiscount = isAdmin || !!user?.permissions.applyDiscount;
  const canForceSale = isAdmin || !!user?.permissions.forceSale;
  const maxDiscount = (user?.maxDiscount && user.maxDiscount > 0)
    ? user.maxDiscount
    : (data.settings.maxDiscount ?? 0);

  const cart = useCartStore((s) => s.cart);
  const setCart = useCartStore((s) => s.setCart);
  const customerId = useCartStore((s) => s.customerId);
  const setCustomerId = useCartStore((s) => s.setCustomerId);
  const remark = useCartStore((s) => s.remark);
  const setRemark = useCartStore((s) => s.setRemark);
  const discount = useCartStore((s) => s.discount);
  const setDiscount = useCartStore((s) => s.setDiscount);
  // Tax is configured once in Settings and applied automatically to every sale.
  const taxPercent = data.settings.taxPercent || 0;
  const method = useCartStore((s) => s.method);
  const setMethod = useCartStore((s) => s.setMethod);
  const received = useCartStore((s) => s.received);
  const setReceived = useCartStore((s) => s.setReceived);
  const printBill = useCartStore((s) => s.printBill);
  const setPrintBill = useCartStore((s) => s.setPrintBill);
  const reset = useCartStore((s) => s.reset);

  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return data.medicines
      .filter((m) => [m.name, m.barcode, m.genericName].some((x) => (x ?? "").toLowerCase().includes(t)))
      .slice(0, 8);
  }, [q, data.medicines]);

  function add(medId: string) {
    const med = data.medicines.find((m) => m.id === medId);
    if (!med) return;
    const outOfStock = med.stockQuantity <= 0;
    if (outOfStock && !canForceSale) { toast.error("Out of stock"); return; }
    if (outOfStock && canForceSale) {
      const ok = window.confirm(`"${med.name}" is out of stock. Force sell anyway?`);
      if (!ok) return;
    }
    setCart((c) => {
      const i = c.findIndex((l) => l.medicineId === medId);
      if (i >= 0) {
        const copy = [...c];
        const nextQty = copy[i].quantity + 1;
        if (nextQty > med.stockQuantity && !canForceSale) { toast.error("Not enough stock"); return c; }
        copy[i] = { ...copy[i], quantity: nextQty, forced: nextQty > med.stockQuantity ? true : copy[i].forced };
        return copy;
      }
      return [...c, {
        medicineId: medId, quantity: 1, salePrice: med.salePrice,
        discountPercent: 0, name: med.name, forced: outOfStock,
      }];
    });
    setQ("");
  }

  function updLine(i: number, patch: Partial<typeof cart[number]>) {
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const subtotal = cart.reduce((s, l) => s + l.salePrice * l.quantity * (1 - l.discountPercent / 100), 0);
  const taxAmt = subtotal * (taxPercent / 100);
  const total = Math.max(0, subtotal + taxAmt - discount);
  const change = Math.max(0, received - total);

  function handleDiscountChange(v: number) {
    const clean = Math.max(0, v || 0);
    if (!isAdmin && maxDiscount > 0 && clean > maxDiscount) {
      toast.error(`Max discount is ${money(maxDiscount, sym)}`);
      setDiscount(maxDiscount);
      return;
    }
    setDiscount(clean);
  }

  function checkout() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    const invoiceNumber = nextInvoiceNumber(data.sales);
    const newSale: Sale = {
      id: uid("sale_"),
      invoiceNumber,
      date: new Date().toISOString(),
      customerId: customerId || undefined,
      remark: remark.trim() || undefined,
      items: cart.map(({ name: _n, forced: _f, ...rest }) => rest),
      discount: canDiscount ? discount : 0,
      taxPercent,
      payments: [{ method: method === "mixed" ? "cash" : method, amount: total }],
      status: "completed",
      createdBy: user?.username,
    };

    mutate((d) => {
      for (const line of cart) {
        const m = d.medicines.find((x) => x.id === line.medicineId);
        if (m) m.stockQuantity = Math.max(0, m.stockQuantity - line.quantity);
      }
      if (customerId) {
        const c = d.customers.find((x) => x.id === customerId);
        if (c) c.loyaltyPoints = (c.loyaltyPoints ?? 0) + Math.floor(total);
      }
      d.sales.push(newSale);
    });
    toast.success(`Sale complete · ${invoiceNumber}`);
    if (printBill) {
      const latest = useProjectStore.getState().data!;
      printReceipt(newSale, latest);
    }
    reset();
  }

  const hasForced = cart.some((l) => l.forced);

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr,380px]">
      <div className="surface-card flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b p-4">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-semibold">Point of Sale</h1>
          {hasForced && (
            <span className="ml-auto flex items-center gap-1 rounded bg-warning/15 px-2 py-1 text-[11px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" /> Contains force-sold items
            </span>
          )}
        </div>
        <div className="relative border-b p-3">
          <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-search
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) add(results[0].id);
            }}
            className="h-11 pl-8 text-sm"
          />
          {results.length > 0 && (
            <div className="absolute left-3 right-3 top-14 z-10 max-h-72 overflow-auto rounded-md border bg-popover shadow-elevated">
              {results.map((m) => (
                <button key={m.id} onClick={() => add(m.id)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted">
                  <span>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{m.barcode || m.genericName || ""}</span>
                  </span>
                  <span className={`text-xs ${m.stockQuantity <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    Stock {m.stockQuantity} · {money(m.salePrice, sym)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? (
            <div className="grid place-items-center py-24 text-sm text-muted-foreground">Cart is empty — scan or search a medicine to begin.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b"><th className="p-2 text-left">Item</th><th className="p-2 text-right w-20">Qty</th><th className="p-2 text-right w-24">Price</th><th className="p-2 text-right w-28">Line</th><th className="w-10"></th></tr>
              </thead>
              <tbody>
                {cart.map((l, i) => {
                  const line = l.salePrice * l.quantity;
                  return (
                    <tr key={l.medicineId} className="border-b last:border-0">
                      <td className="p-2">
                        {l.name}
                        {l.forced && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">FORCED</span>}
                      </td>
                      <td className="p-2"><Input type="number" min={1} className="h-8 text-right" value={l.quantity || ""} onChange={(e) => updLine(i, { quantity: Math.max(1, +e.target.value || 1) })} /></td>
                      <td className="p-2"><Input type="number" className="h-8 text-right" value={l.salePrice || ""} onChange={(e) => updLine(i, { salePrice: +e.target.value || 0 })} /></td>
                      <td className="p-2 text-right tabular-nums">{money(line, sym)}</td>
                      <td className="p-2 text-right"><Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="surface-card flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Receipt className="h-4 w-4" /> Checkout</h2>
        <div>
          <Label className="text-xs">Customer (optional)</Label>
          <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Walk-in customer</SelectItem>
              {data.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Remark (optional)</Label>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <Row k="Subtotal" v={money(subtotal, sym)} />
          <div className="mt-2">
            <Row k={`Tax (${taxPercent}%)`} v={money(taxAmt, sym)} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Label className="w-20 shrink-0 whitespace-nowrap text-xs">Discount</Label>
            <Input
              type="number" className="h-8 flex-1"
              disabled={!canDiscount}
              value={discount || ""}
              onChange={(e) => handleDiscountChange(+e.target.value)}
            />
          </div>
          {!isAdmin && maxDiscount > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">Max discount: {money(maxDiscount, sym)}</p>
          )}
          <div className="mt-3 flex items-center justify-between border-t pt-2">
            <span className="font-display font-semibold">Total</span>
            <span className="font-display text-xl font-bold tabular-nums">{money(total, sym)}</span>
          </div>
        </div>
        <div>
          <Label className="text-xs">Payment method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {method === "cash" && (
          <>
            <div>
              <Label className="text-xs">Cash received (optional)</Label>
              <Input type="number" value={received || ""} onChange={(e) => setReceived(+e.target.value || 0)} />
            </div>
            <Row k="Change" v={money(change, sym)} />
          </>
        )}
        <label className="mt-auto flex items-center gap-2 text-sm">
          <Checkbox checked={printBill} onCheckedChange={(v) => setPrintBill(v === true)} />
          <span>Print bill</span>
        </label>
        <Button size="lg" onClick={checkout} disabled={cart.length === 0}>Complete sale</Button>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>;
}
