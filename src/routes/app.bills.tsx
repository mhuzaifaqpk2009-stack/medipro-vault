import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Receipt, Printer, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import { toast } from "sonner";
import { printReceipt } from "@/lib/receipt";
import { usePrintAction } from "@/lib/print-action";
import { saleTotal } from "@/lib/sale-math";
import type { Sale } from "@/domain/schema";

import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/app/bills")({
  component: () => <PermissionGate perm="bills"><BillsPage /></PermissionGate>,
});

function BillsPage() {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const mutate = useProjectStore((s) => s.mutate);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [...data.sales].sort((a, b) => +new Date(b.date) - +new Date(a.date));
    if (!s) return all.slice(0, 100);
    return all.filter((sale) => {
      if (sale.invoiceNumber.toLowerCase().includes(s)) return true;
      const cust = data.customers.find((c) => c.id === sale.customerId);
      if (cust?.name.toLowerCase().includes(s)) return true;
      return false;
    });
  }, [q, data.sales, data.customers]);

  const totalOf = (sale: Sale) => saleTotal(sale);

  function removeBill(sale: Sale) {
    if (!window.confirm(`Delete bill ${sale.invoiceNumber}? The invoice counter is not affected.`)) return;
    mutate((d) => { d.sales = d.sales.filter((x) => x.id !== sale.id); });
    if (selected?.id === sale.id) setSelected(null);
    toast.success("Bill deleted");
  }

  async function reprint(sale: Sale) {
    mutate((d) => {
      const target = d.sales.find((x) => x.id === sale.id);
      if (target) target.reprints = [...(target.reprints ?? []), new Date().toISOString()];
    }, { history: false });
    const latest = useProjectStore.getState().data!;
    const fresh = latest.sales.find((x) => x.id === sale.id) ?? sale;
    setSelected(fresh);
    await printReceipt(fresh, latest);
  }

  usePrintAction(() => {
    if (!selected) { toast.message("Select a bill to print"); return; }
    return reprint(selected);
  });

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr,420px]">
      <div className="surface-card flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b p-4">
          <Receipt className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-semibold">Bills & Invoices</h1>
        </div>
        <div className="relative border-b p-3">
          <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-search
            placeholder="Search by invoice # or customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 pl-8 text-sm"
            autoFocus
          />

        </div>
        <div className="flex-1 overflow-auto">
          {list.length === 0 ? (
            <div className="grid place-items-center py-24 text-sm text-muted-foreground">
              No bills found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 text-left">Bill code</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-right">Items</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const cust = data.customers.find((c) => c.id === s.customerId);
                  return (
                    <tr
                      key={s.id}
                      className={`cursor-pointer border-b last:border-0 hover:bg-muted ${selected?.id === s.id ? "bg-muted" : ""}`}
                      onClick={() => setSelected(s)}
                    >
                      <td className="p-2 font-mono text-xs">{s.invoiceNumber}</td>
                      <td className="p-2 text-xs">{new Date(s.date).toLocaleString()}</td>
                      <td className="p-2">{cust?.name ?? "Walk-in"}</td>
                      <td className="p-2 text-right tabular-nums">{s.items.length}</td>
                      <td className="p-2 text-right tabular-nums">{money(totalOf(s), sym)}</td>
                      <td className="p-2 text-right">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7" title="Delete this bill"
                          onClick={(e) => { e.stopPropagation(); removeBill(s); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="surface-card flex flex-col p-4">
        {!selected ? (
          <div className="grid place-items-center py-24 text-center text-sm text-muted-foreground">
            Select a bill to view its details.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Bill code</p>
                <p className="font-mono font-semibold">{selected.invoiceNumber}</p>
              </div>
              <Button size="sm" onClick={() => void reprint(selected)}>
                <Printer className="mr-1.5 h-4 w-4" /> Reprint
              </Button>
            </div>
            {(selected.reprints ?? []).length > 0 && (
              <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2">
                {[...(selected.reprints ?? [])].reverse().map((t, i) => (
                  <p key={i} className="text-[11px] font-medium text-warning">
                    Reprint ({new Date(t).toLocaleString()})
                  </p>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(selected.date).toLocaleString()}
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Customer: </span>
              {data.customers.find((c) => c.id === selected.customerId)?.name ?? "Walk-in"}
            </p>
            {selected.remark && (
              <p className="text-xs">
                <span className="text-muted-foreground">Remarks: </span>
                {selected.remark}
              </p>
            )}
            <div className="mt-4 flex-1 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((l, i) => {
                    const m = data.medicines.find((x) => x.id === l.medicineId);
                    const line = l.salePrice * l.quantity * (1 - l.discountPercent / 100);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">{m?.name ?? l.medicineId}</td>
                        <td className="p-2 text-right tabular-nums">{l.quantity}</td>
                        <td className="p-2 text-right tabular-nums">{money(l.salePrice, sym)}</td>
                        <td className="p-2 text-right tabular-nums">{money(line, sym)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-md bg-muted/30 p-3 text-sm">
              <Row k={`Discount (${selected.discount || 0}%)`} v="" />
              <Row k={`Tax (${selected.taxPercent}%)`} v="" />
              <div className="mt-2 flex items-center justify-between border-t pt-2 font-display text-lg font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(totalOf(selected), sym)}</span>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
