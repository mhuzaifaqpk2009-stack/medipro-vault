import { useMemo, useState } from "react";
import { Users, Package, RotateCcw, Ban, BadgePercent, WalletCards } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import type { ProjectData, Sale } from "@/domain/schema";

type Period = "daily" | "weekly" | "monthly" | "yearly";
const PERIOD_LABELS: Record<Period, string> = { daily: "Today", weekly: "This week", monthly: "This month", yearly: "This year" };
function periodStart(period: Period): number {
  const now = new Date(); const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === "daily") return day;
  if (period === "weekly") return day - 6 * 86_400_000;
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return new Date(now.getFullYear(), 0, 1).getTime();
}
function saleTotals(s: Sale, data: ProjectData) {
  const gross = s.items.reduce((sum, it) => sum + it.salePrice * it.quantity * (1 - it.discountPercent / 100), 0);
  const net = Math.max(0, gross + gross * ((s.taxPercent || 0) / 100) - (gross + gross * ((s.taxPercent || 0) / 100)) * ((s.discount || 0) / 100));
  const cogs = s.items.reduce((sum, it) => sum + (it.costPriceAtSale ?? data.medicines.find((m) => m.id === it.medicineId)?.purchasePrice ?? 0) * it.quantity, 0);
  const discount = s.items.reduce((sum, it) => sum + it.salePrice * it.quantity * ((it.discountPercent || 0) / 100), 0) + gross * ((s.discount || 0) / 100);
  const payments = s.payments.reduce((a, p) => ({ ...a, [p.method]: (a[p.method] || 0) + p.amount }), {} as Record<string, number>);
  return { net, profit: net - cogs, discount, payments, forcedUnits: s.items.filter((i) => i.forcedSale).reduce((n, i) => n + i.quantity, 0) };
}
interface StaffRow { username: string; saleCount: number; revenue: number; profit: number; discount: number; cash: number; credit: number; forcedUnits: number; items: { name: string; qty: number }[]; }

export function StaffSalesReport() {
  const data = useProjectStore((s) => s.data!); const sym = useCurrencySymbol(); const [period, setPeriod] = useState<Period>("monthly");
  const rows = useMemo<StaffRow[]>(() => {
    const start = periodStart(period); const byUser = new Map<string, StaffRow>();
    for (const s of data.sales) {
      if (new Date(s.date).getTime() < start) continue;
      const uname = s.createdBy?.trim() || "Unknown";
      const row = byUser.get(uname) ?? { username: uname, saleCount: 0, revenue: 0, profit: 0, discount: 0, cash: 0, credit: 0, forcedUnits: 0, items: [] };
      if (s.status === "cancelled") continue;
      const t = saleTotals(s, data); row.saleCount++; row.revenue += t.net; row.profit += t.profit; row.discount += t.discount; row.cash += t.payments.cash || 0; row.credit += t.payments.credit || 0; row.forcedUnits += t.forcedUnits;
      for (const it of s.items) { const name = data.medicines.find((m) => m.id === it.medicineId)?.name ?? "—"; const old = row.items.find((x) => x.name === name); if (old) old.qty += it.quantity; else row.items.push({ name, qty: it.quantity }); }
      byUser.set(uname, row);
    }
    return [...byUser.values()].sort((a, b) => b.profit - a.profit);
  }, [data, period]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ sales: a.sales + r.saleCount, revenue: a.revenue + r.revenue, profit: a.profit + r.profit, discount: a.discount + r.discount, cash: a.cash + r.cash, credit: a.credit + r.credit, forced: a.forced + r.forcedUnits }), { sales: 0, revenue: 0, profit: 0, discount: 0, cash: 0, credit: 0, forced: 0 }), [rows]);
  return <div className="grid gap-4">
    <div className="surface-card flex flex-wrap items-center gap-3 p-4"><Users className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Staff & operational performance</span><Select value={period} onValueChange={(v) => setPeriod(v as Period)}><SelectTrigger className="ml-auto h-9 w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PERIOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<WalletCards />} label="Revenue" value={money(totals.revenue, sym)} /><Metric icon={<Package />} label="Profit" value={money(totals.profit, sym)} /><Metric icon={<BadgePercent />} label="Discounts" value={money(totals.discount, sym)} /><Metric icon={<Ban />} label="Forced-sale units" value={String(totals.forced)} /></div>
    {rows.length === 0 ? <div className="surface-card p-10 text-center text-sm text-muted-foreground">No sales in this period.</div> : rows.map((r) => <section key={r.username} className="surface-card p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-base font-semibold">{r.username}</h3><div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:flex"><span>{r.saleCount} sales</span><span>{money(r.revenue, sym)} revenue</span><span className="font-semibold">{money(r.profit, sym)} profit</span></div></div><div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4"><span>Cash: {money(r.cash, sym)}</span><span>Credit: {money(r.credit, sym)}</span><span>Discounts: {money(r.discount, sym)}</span><span>Forced units: {r.forcedUnits}</span></div><div className="mt-4 mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" /> Items sold</div><div className="flex flex-wrap gap-2">{r.items.sort((a, b) => b.qty - a.qty).map((it) => <span key={it.name} className="rounded-full border px-2.5 py-1 text-xs">{it.name} <span className="text-muted-foreground">×{it.qty}</span></span>)}</div></section>)}
  </div>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="surface-card flex items-center gap-3 p-4"><span className="text-primary">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-bold tabular-nums">{value}</p></div></div>; }
