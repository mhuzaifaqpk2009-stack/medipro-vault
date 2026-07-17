import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Pill,
  AlertTriangle,
  CalendarX,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  ShoppingCart,
  ArrowUpRight,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const data = useProjectStore((s) => s.data)!;
  const currency = data.settings.currencySymbol || "$";

  const kpis = [
    { label: "Total Medicines", value: data.medicines.length, icon: Pill, tone: "primary" },
    { label: "Low Stock", value: 0, icon: AlertTriangle, tone: "warning" },
    { label: "Expired", value: 0, icon: CalendarX, tone: "destructive" },
    { label: "Today's Sales", value: `${currency}0`, icon: ShoppingCart, tone: "info" },
    { label: "Today's Profit", value: `${currency}0`, icon: TrendingUp, tone: "success" },
    { label: "Monthly Sales", value: `${currency}0`, icon: DollarSign, tone: "primary" },
    { label: "Customers", value: data.customers.length, icon: Users, tone: "info" },
    { label: "Suppliers", value: data.suppliers.length, icon: Building2, tone: "primary" },
  ] as const;

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
            {new Date().toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
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
              <div
                className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${toneMap[k.tone]} opacity-60 blur-2xl`}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums">{k.value}</p>
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${toneMap[k.tone]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="relative mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ArrowUpRight className="h-3 w-3" /> live figures update after each sale
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Sales trend</h2>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
          </div>
          <ChartPlaceholder />
        </div>
        <div className="surface-card p-6">
          <h2 className="font-display text-base font-semibold">Top selling</h2>
          <p className="text-xs text-muted-foreground">By quantity, this month</p>
          <div className="mt-6 grid place-items-center py-12 text-center text-sm text-muted-foreground">
            <Pill className="mb-2 h-8 w-8 text-muted-foreground/40" />
            Start selling to populate this list.
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  const bars = Array.from({ length: 14 }, (_, i) => 20 + ((i * 37) % 60));
  return (
    <div className="flex h-56 items-end gap-2">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ duration: 0.5, delay: i * 0.03 }}
          className="flex-1 rounded-t bg-gradient-to-t from-primary/70 to-primary-glow/60"
        />
      ))}
    </div>
  );
}
