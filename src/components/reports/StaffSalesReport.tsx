import { useMemo, useState } from "react";
import { Users, Package } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import type { ProjectData, Sale } from "@/domain/schema";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
};

function periodStart(period: Period): number {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === "daily") return startOfDay;
  if (period === "weekly") return startOfDay - 6 * 86_400_000; // last 7 days including today
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return new Date(now.getFullYear(), 0, 1).getTime();
}

function saleTotals(s: Sale, data: ProjectData) {
  const gross = s.items.reduce(
    (sum, it) => sum + it.salePrice * it.quantity * (1 - it.discountPercent / 100), 0,
  );
  const withTax = gross + gross * ((s.taxPercent || 0) / 100);
  const net = Math.max(0, withTax - withTax * ((s.discount || 0) / 100));
  const cogs = s.items.reduce((sum, it) => {
    const med = data.medicines.find((x) => x.id === it.medicineId);
    return sum + (med ? med.purchasePrice * it.quantity : 0);
  }, 0);
  return { net, profit: net - cogs };
}

interface StaffRow {
  username: string;
  saleCount: number;
  revenue: number;
  profit: number;
  items: { name: string; qty: number }[];
}

export function StaffSalesReport() {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const [period, setPeriod] = useState<Period>("monthly");

  const rows = useMemo<StaffRow[]>(() => {
    const start = periodStart(period);
    const byUser = new Map<string, StaffRow>();
    for (const s of data.sales) {
      if (s.status === "cancelled") continue;
      if (new Date(s.date).getTime() < start) continue;
      const uname = s.createdBy?.trim() || "Unknown";
      const row = byUser.get(uname) ?? { username: uname, saleCount: 0, revenue: 0, profit: 0, items: [] };
      const { net, profit } = saleTotals(s, data);
      row.saleCount += 1;
      row.revenue += net;
      row.profit += profit;
      for (const it of s.items) {
        const med = data.medicines.find((m) => m.id === it.medicineId);
        const name = med?.name ?? "—";
        const existing = row.items.find((x) => x.name === name);
        if (existing) existing.qty += it.quantity;
        else row.items.push({ name, qty: it.quantity });
      }
      byUser.set(uname, row);
    }
    return [...byUser.values()].sort((a, b) => b.profit - a.profit);
  }, [data, period]);

  return (
    <div className="grid gap-4">
      <div className="surface-card flex flex-wrap items-center gap-3 p-4">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Staff sales</span>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="ml-auto h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{PERIOD_LABELS.daily}</SelectItem>
            <SelectItem value="weekly">{PERIOD_LABELS.weekly}</SelectItem>
            <SelectItem value="monthly">{PERIOD_LABELS.monthly}</SelectItem>
            <SelectItem value="yearly">{PERIOD_LABELS.yearly}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          No sales in this period.
        </div>
      ) : (
        rows.map((r) => (
          <section key={r.username} className="surface-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold">{r.username}</h3>
              <div className="flex gap-4 text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {r.saleCount} sale{r.saleCount === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {money(r.revenue, sym)} revenue
                </span>
                <span className="tabular-nums font-semibold">{money(r.profit, sym)} profit</span>
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Items sold
            </div>
            <div className="flex flex-wrap gap-2">
              {r.items
                .sort((a, b) => b.qty - a.qty)
                .map((it) => (
                  <span key={it.name} className="rounded-full border px-2.5 py-1 text-xs">
                    {it.name} <span className="text-muted-foreground">×{it.qty}</span>
                  </span>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
