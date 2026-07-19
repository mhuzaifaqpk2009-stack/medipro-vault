import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingCart, Search, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { nextInvoiceNumber, printReceipt } from "@/lib/receipt";
import type { SaleItem, PaymentMethod, Sale } from "@/domain/schema";

export const Route = createFileRoute("/app/sales")({ component: SalesPage });

interface CartLine extends SaleItem { name: string; }

function SalesPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState(0);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return data.medicines
      .filter((m) => [m.name, m.barcode, m.genericName].some((x) => (x ?? "").toLowerCase().includes(s)))
      .slice(0, 8);
  }, [q, data.medicines]);

  function add(medId: string) {
    const med = data.medicines.find((m) => m.id === medId);
    if (!med) return;
    if (med.stockQuantity <= 0) { toast.error("Out of stock"); return; }
    setCart((c) => {
      const i = c.findIndex((l) => l.medicineId === medId);
      if (i >= 0) {
        const copy = [...c];
        if (copy[i].quantity + 1 > med.stockQuantity) { toast.error("Not enough stock"); return c; }
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [...c, { medicineId: medId, quantity: 1, salePrice: med.salePrice, discountPercent: 0, name: med.name }];
    });
    setQ("");
  }

  function updLine(i: number, patch: Partial<CartLine>) {
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const subtotal = cart.reduce((s, l) => s + l.salePrice * l.quantity * (1 - l.discountPercent / 100), 0);
  const taxAmt = subtotal * (data.settings.taxPercent / 100);
  const total = Math.max(0, subtotal + taxAmt - discount);
  const change = Math.max(0, received - total);

  function checkout() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (method === "cash" && received < total) { toast.error("Insufficient cash received"); return; }
    const invoiceNumber = nextInvoiceNumber(data.sales);
    const newSale: Sale = {
      id: uid("sale_"),
      invoiceNumber,
      date: new Date().toISOString(),
      customerId: customerId || undefined,
      items: cart.map(({ name: _n, ...rest }) => rest),
      discount,
      taxPercent: data.settings.taxPercent,
      payments: [{ method: method === "mixed" ? "cash" : method, amount: total }],
      status: "completed",
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
    // Print receipt with the latest data (includes the new sale)
    const latest = useProjectStore.getState().data!;
    printReceipt(newSale, latest);
    setCart([]); setDiscount(0); setReceived(0); setCustomerId("");
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr,380px]">
      <div className="surface-card flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b p-4">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-semibold">Point of Sale</h1>
        </div>
        <div className="relative border-b p-3">
          <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) add(results[0].id);
            }}
            placeholder="Scan barcode or search medicine…  (Enter to add top match)"
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
                  <span className="text-xs text-muted-foreground">Stock {m.stockQuantity} · {money(m.salePrice, sym)}</span>
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
                <tr className="border-b"><th className="p-2 text-left">Item</th><th className="p-2 text-right w-20">Qty</th><th className="p-2 text-right w-24">Price</th><th className="p-2 text-right w-20">Disc %</th><th className="p-2 text-right w-28">Line</th><th className="w-10"></th></tr>
              </thead>
              <tbody>
                {cart.map((l, i) => {
                  const line = l.salePrice * l.quantity * (1 - l.discountPercent / 100);
                  return (
                    <tr key={l.medicineId} className="border-b last:border-0">
                      <td className="p-2">{l.name}</td>
                      <td className="p-2"><Input type="number" min={1} className="h-8 text-right" value={l.quantity} onChange={(e) => updLine(i, { quantity: Math.max(1, +e.target.value || 1) })} /></td>
                      <td className="p-2"><Input type="number" className="h-8 text-right" value={l.salePrice} onChange={(e) => updLine(i, { salePrice: +e.target.value || 0 })} /></td>
                      <td className="p-2"><Input type="number" className="h-8 text-right" value={l.discountPercent} onChange={(e) => updLine(i, { discountPercent: Math.min(100, Math.max(0, +e.target.value || 0)) })} /></td>
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
            <SelectTrigger className="h-9"><SelectValue placeholder="Walk-in" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Walk-in</SelectItem>
              {data.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <Row k="Subtotal" v={money(subtotal, sym)} />
          <Row k={`Tax (${data.settings.taxPercent}%)`} v={money(taxAmt, sym)} />
          <div className="mt-2 flex items-center gap-2">
            <Label className="text-xs">Discount</Label>
            <Input type="number" className="h-8" value={discount} onChange={(e) => setDiscount(Math.max(0, +e.target.value || 0))} />
          </div>
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
              <Label className="text-xs">Cash received</Label>
              <Input type="number" value={received} onChange={(e) => setReceived(+e.target.value || 0)} />
            </div>
            <Row k="Change" v={money(change, sym)} />
          </>
        )}
        <Button size="lg" className="mt-auto" onClick={checkout} disabled={cart.length === 0}>Complete sale</Button>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>;
}
