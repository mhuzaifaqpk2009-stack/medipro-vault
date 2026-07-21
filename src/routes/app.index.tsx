import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Pill, AlertTriangle, CalendarX, TrendingUp, DollarSign, Users, Building2,
  ShoppingCart, ArrowUpRight, Eye, EyeOff,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { isCounterVisible, type CounterId } from "@/lib/users";
import { daysUntil, money } from "@/lib/format";
import { AdminGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/app/")({
  component: () => <AdminGate><Dashboard /></AdminGate>,
});

function Dashboard() {
  const data = useProjectStore((s) => s.data)!;
  const sym = data.settings.currencySymbol || "$";

  const stats = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

    const lowStock = data.medicines.filter(
      (m) => m.stockQuantity <= (m.minimumStock ?? 0) && m.stockQuantity >= 0,
    ).length;
    const expired = data.medicines.filter((m) => {
      const d = daysUntil(m.expiryDate);
      return d !== null && d <= 0;
    }).length;

    const saleTotal = (s: typeof data.sales[number]) => {
      const sub = s.items.reduce(
        (a, l) => a + l.salePrice * l.quantity * (1 - l.discountPercent / 100), 0,
      );
      const tax = sub * (s.taxPercent / 100);
      return Math.max(0, sub + tax - s.discount);
    };
    const saleProfit = (s: typeof data.sales[number]) =>
      s.items.reduce((a, l) => {
        const m = data.medicines.find((x) => x.id === l.medicineId);
        const cost = (m?.purchasePrice ?? 0) * l.quantity;
        const rev = l.salePrice * l.quantity * (1 - l.discountPercent / 100);
        return a + (rev - cost);
      }, 0);

    const active = data.sales.filter((s) => s.status === "completed");
    const todaysSales = active.filter((s) => new Date(s.date).getTime() >= startOfDay);
    const monthSales = active.filter((s) => new Date(s.date).getTime() >= startOfMonth);

    const todayRevenue = todaysSales.reduce((a, s) => a + saleTotal(s), 0);
    const todayProfit = todaysSales.reduce((a, s) => a + saleProfit(s), 0);
    const monthRevenue = monthSales.reduce((a, s) => a + saleTotal(s), 0);

    // 14-day series
    const days: { label: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startOfDay - i * 86400_000);
      const start = d.getTime();
      const end = start + 86400_000;
      const v = active
        .filter((s) => {
          const t = new Date(s.date).getTime();
          return t >= start && t < end;
        })
        .reduce((a, s) => a + saleTotal(s), 0);
      days.push({ label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), value: v });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.value));

    // Top selling by qty
    const qtyMap = new Map<string, number>();
    for (const s of active) {
      for (const l of s.items) qtyMap.set(l.medicineId, (qtyMap.get(l.medicineId) ?? 0) + l.quantity);
    }
    const top = Array.from(qtyMap.entries())
      .map(([id, qty]) => ({ id, qty, name: data.medicines.find((m) => m.id === id)?.name ?? "—" }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
    const mostSold = top[0];

    return {
      lowStock, expired,
      todayRevenue, todayProfit, monthRevenue,
      days, maxDay, top, mostSold,
    };
  }, [data]);

  const user = useSession((st) => st.user);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setHidden((h) => ({ ...h, [k]: !h[k] }));
  const mask = "••••";
  const allKpis: { id: CounterId; label: string; value: any; icon: any; tone: string }[] = [
    { id: "totalMedicines", label: "Total Medicines", value: data.medicines.length, icon: Pill, tone: "primary" },
    { id: "lowStock", label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, tone: "warning" },
    { id: "expired", label: "Expired", value: stats.expired, icon: CalendarX, tone: "destructive" },
    { id: "todayRevenue", label: "Today's Sales", value: money(stats.todayRevenue, sym), icon: ShoppingCart, tone: "info" },
    { id: "todayProfit", label: "Today's Profit", value: money(stats.todayProfit, sym), icon: TrendingUp, tone: "success" },
    { id: "monthRevenue", label: "Monthly Sales", value: money(stats.monthRevenue, sym), icon: DollarSign, tone: "primary" },
    { id: "customers", label: "Customers", value: data.customers.length, icon: Users, tone: "info" },
    { id: "suppliers", label: "Suppliers", value: data.suppliers.length, icon: Building2, tone: "primary" },
  ];
  const kpis = allKpis.filter((k) => isCounterVisible(user, k.id));
  const showTrend = isCounterVisible(user, "salesTrend");
  const showMostSold = isCounterVisible(user, "mostSold");

  const toneMap: Record<string, string> = {
    primary: "from-primary/15 to-primary/0 text-primary",
    warning: "from-warning/20 to-warning/0 text-warning",
    destructive: "from-destructive/15 to-destructive/0 text-destructive",
    success: "from-success/20 to-success/0 text-success",
    info: "from-info/20 to-info/0 text-info",
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Overview</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {data.settings.pharmacyName || data.meta.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back — here's a snapshot of your pharmacy.
          </p>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground md:block">
          <p>{new Date().toLocaleDateString(undefined, { weekday: "long" })}</p>
          <p className="font-display text-lg text-foreground">
            {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="surface-card group relative overflow-hidden p-5"
            >
              <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${toneMap[k.tone]} opacity-60 blur-2xl`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums">{hidden[k.id] ? mask : k.value}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggle(k.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" title={hidden[k.id] ? "Show" : "Hide"}>
                    {hidden[k.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${toneMap[k.tone]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ArrowUpRight className="h-3 w-3" /> live figures update after each sale
              </div>
            </motion.div>
          );
        })}
      </div>

      {(showTrend || showMostSold) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {showTrend && (
            <div className="surface-card p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold">Sales trend</h2>
                  <p className="text-xs text-muted-foreground">Last 14 days</p>
                </div>
                <button onClick={() => toggle("_trend")} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                  {hidden._trend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {hidden._trend ? (
                <div className="grid h-56 place-items-center text-sm text-muted-foreground">Hidden</div>
              ) : (
                <>
                  <div className="flex h-56 items-end gap-2">
                    {stats.days.map((d, i) => {
                      const h = (d.value / stats.maxDay) * 100;
                      return (
                        <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(2, h)}%` }}
                            transition={{ duration: 0.5, delay: i * 0.03 }}
                            className="w-full rounded-t bg-gradient-to-t from-primary/70 to-primary-glow/60"
                            title={`${d.label}: ${money(d.value, sym)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>{stats.days[0]?.label}</span>
                    <span>{stats.days[stats.days.length - 1]?.label}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {showMostSold && (
            <div className="surface-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold">Most sold</h2>
                  <p className="text-xs text-muted-foreground">All-time top movers</p>
                </div>
                <button onClick={() => toggle("_top")} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                  {hidden._top ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {hidden._top ? (
                <div className="mt-6 grid place-items-center py-12 text-sm text-muted-foreground">Hidden</div>
              ) : stats.top.length === 0 ? (
                <div className="mt-6 grid place-items-center py-12 text-center text-sm text-muted-foreground">
                  <Pill className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  Start selling to populate this list.
                </div>
              ) : (
                <>
                  {stats.mostSold && (
                    <div className="mt-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/0 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-primary">Best seller</p>
                      <p className="mt-1 font-display text-lg font-bold">{stats.mostSold.name}</p>
                      <p className="text-xs text-muted-foreground">{stats.mostSold.qty} units sold</p>
                    </div>
                  )}
                  <ul className="mt-4 space-y-2">
                    {stats.top.slice(1).map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{t.name}</span>
                        <span className="ml-2 tabular-nums text-muted-foreground">{t.qty}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
