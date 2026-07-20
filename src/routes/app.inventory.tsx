import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Boxes, AlertTriangle, CalendarX, PackageX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { daysUntil } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/app/inventory")({
  component: () => <PermissionGate perm="inventory"><InventoryPage /></PermissionGate>,
});

function InventoryPage() {
  const meds = useProjectStore((s) => s.data!.medicines);

  const groups = useMemo(() => {
    const low: typeof meds = [], out: typeof meds = [], nearExp: typeof meds = [], exp: typeof meds = [];
    for (const m of meds) {
      if (m.stockQuantity === 0) out.push(m);
      else if (m.stockQuantity <= (m.minimumStock ?? 0)) low.push(m);
      const d = daysUntil(m.expiryDate);
      if (d !== null) { if (d < 0) exp.push(m); else if (d <= 30) nearExp.push(m); }
    }
    return { low, out, nearExp, exp };
  }, [meds]);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Boxes className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Inventory health</h1><p className="text-sm text-muted-foreground">Live stock and expiry alerts</p></div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={<PackageX />} label="Out of stock" n={groups.out.length} tone="destructive" />
        <KPI icon={<AlertTriangle />} label="Low stock" n={groups.low.length} tone="warning" />
        <KPI icon={<CalendarX />} label="Expired" n={groups.exp.length} tone="destructive" />
        <KPI icon={<CalendarX />} label="Expiring ≤ 30d" n={groups.nearExp.length} tone="warning" />
      </div>

      <Section title="Out of stock" items={groups.out} />
      <Section title="Low stock" items={groups.low} />
      <Section title="Expired" items={groups.exp} expiryCol />
      <Section title="Near expiry (30 days)" items={groups.nearExp} expiryCol />
    </div>
  );
}

function KPI({ icon, label, n, tone }: { icon: React.ReactNode; label: string; n: number; tone: string }) {
  const map: Record<string, string> = { warning: "text-warning", destructive: "text-destructive" };
  return (
    <div className="surface-card p-4">
      <div className={`mb-2 flex items-center gap-2 ${map[tone]}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="font-display text-3xl font-bold tabular-nums">{n}</p>
    </div>
  );
}

function Section({ title, items, expiryCol }: { title: string; items: any[]; expiryCol?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="surface-card mt-5 overflow-hidden">
      <div className="border-b px-4 py-2 text-sm font-medium">{title} ({items.length})</div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Batch</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          {expiryCol && <TableHead>Expiry</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {items.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell className="font-mono text-xs">{m.batchNumber || "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{m.stockQuantity}</TableCell>
              {expiryCol && <TableCell>{m.expiryDate || "—"}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
