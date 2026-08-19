import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, PackageCheck, RotateCcw, ShoppingCart, WalletCards, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/store/session-store";
import { PermissionGate } from "@/components/PermissionGate";

type Step = { label: string; to?: "/app/sales" | "/app/purchases" | "/app/stocktake" | "/app/operations" | "/app/bills" };
type Flow = { id: string; title: string; description: string; icon: typeof ShoppingCart; permission: keyof NonNullable<ReturnType<typeof useSession.getState>["user"]>["permissions"]; steps: Step[] };

const FLOWS: Flow[] = [
  { id: "sale", title: "Fast Sale", description: "Keep the sale moving from medicine selection through checkout and receipt.", icon: ShoppingCart, permission: "sales", steps: [{ label: "Open POS", to: "/app/sales" }, { label: "Add medicines", to: "/app/sales" }, { label: "Customer / payment", to: "/app/sales" }, { label: "Finish and receipt", to: "/app/sales" }] },
  { id: "purchase", title: "Receive Purchase", description: "Move from supplier purchase to receiving and inventory confirmation without losing context.", icon: PackageCheck, permission: "purchases", steps: [{ label: "Open Purchases", to: "/app/purchases" }, { label: "Confirm supplier", to: "/app/purchases" }, { label: "Receive quantities / batches", to: "/app/operations" }, { label: "Confirm inventory", to: "/app/operations" }] },
  { id: "stocktake", title: "Stock Take", description: "Count physical stock, reconcile differences, then return to normal operations.", icon: ClipboardCheck, permission: "stocktake", steps: [{ label: "Open Stock Take", to: "/app/stocktake" }, { label: "Count / scan", to: "/app/stocktake" }, { label: "Review differences", to: "/app/stocktake" }, { label: "Apply reconciliation", to: "/app/stocktake" }] },
  { id: "return", title: "Returns", description: "Process a customer or supplier return while keeping stock and transaction history connected.", icon: RotateCcw, permission: "operations", steps: [{ label: "Open Returns", to: "/app/operations" }, { label: "Select original transaction", to: "/app/operations" }, { label: "Select quantities", to: "/app/operations" }, { label: "Confirm return", to: "/app/operations" }] },
  { id: "closing", title: "Daily Closing", description: "Walk through cash, finance and outstanding work before closing the pharmacy day.", icon: WalletCards, permission: "operations", steps: [{ label: "Open Finance", to: "/app/operations" }, { label: "Check expected cash", to: "/app/operations" }, { label: "Review expenses / ledgers", to: "/app/operations" }, { label: "Confirm daily close", to: "/app/operations" }] },
];

export const Route = createFileRoute("/app/workflows")({ component: () => <PermissionGate perm="sales"><WorkflowCenter /></PermissionGate> });

function WorkflowCenter() {
  const user = useSession((s) => s.user);
  const available = useMemo(() => FLOWS.filter((f) => user?.role === "admin" || Boolean(user?.permissions?.[f.permission])), [user]);
  const [activeId, setActiveId] = useState(available[0]?.id ?? "");
  const [completed, setCompleted] = useState<Record<string, number>>({});
  const active = available.find((f) => f.id === activeId) ?? available[0];
  const step = active ? completed[active.id] ?? 0 : 0;
  if (!active) return null;
  const Icon = active.icon;
  const next = () => setCompleted((v) => ({ ...v, [active.id]: Math.min(step + 1, active.steps.length) }));
  const reset = () => setCompleted((v) => ({ ...v, [active.id]: 0 }));

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <div className="mb-6 flex items-start gap-3"><Workflow className="mt-1 h-7 w-7 text-primary" /><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Phase 2</p><h1 className="font-display text-3xl font-bold">Workflow Engine</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Start a pharmacy workflow once, follow its steps, and jump directly to the screen needed for the current step. Permissions are respected at every destination.</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[300px,1fr]">
      <div className="surface-card p-3"><p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflows</p>{available.map((f) => { const I=f.icon; return <button key={f.id} onClick={() => setActiveId(f.id)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ${f.id===active.id?"bg-primary/10 text-primary":"hover:bg-muted"}`}><I className="h-5 w-5" /><span className="min-w-0"><b className="block text-sm">{f.title}</b><span className="text-xs text-muted-foreground">{completed[f.id] ?? 0}/{f.steps.length} steps</span></span></button>; })}</div>
      <div className="surface-card p-6">
        <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><Icon className="mt-1 h-6 w-6 text-primary" /><div><h2 className="font-display text-xl font-semibold">{active.title}</h2><p className="mt-1 text-sm text-muted-foreground">{active.description}</p></div></div><Button variant="outline" size="sm" onClick={reset}>Reset</Button></div>
        <div className="mt-6 space-y-3">{active.steps.map((s, i) => { const done=i<step; const current=i===step; return <div key={s.label} className={`flex items-center gap-3 rounded-lg border p-3 ${current?"border-primary bg-primary/5":""}`}><div className={`grid h-8 w-8 place-items-center rounded-full border ${done?"border-primary bg-primary text-primary-foreground":""}`}>{done?<CheckCircle2 className="h-4 w-4"/>:<span className="text-xs font-bold">{i+1}</span>}</div><div className="flex-1"><p className={`text-sm font-medium ${done?"line-through text-muted-foreground":""}`}>{s.label}</p>{current&&<p className="text-xs text-muted-foreground">Current step</p>}</div>{current&&s.to&&<Link to={s.to}><Button size="sm">Open <ArrowRight className="ml-1 h-4 w-4"/></Button></Link>}</div>; })}</div>
        <div className="mt-6 flex items-center justify-between border-t pt-4"><p className="text-xs text-muted-foreground">{step >= active.steps.length ? "Workflow complete — ready for the next task." : `Step ${step + 1} of ${active.steps.length}`}</p>{step < active.steps.length ? <Button onClick={next}>{step===active.steps.length-1?"Complete workflow":"Mark step complete"}<CheckCircle2 className="ml-2 h-4 w-4"/></Button> : <Button onClick={reset}>Start again</Button>}</div>
      </div>
    </div>
  </div>;
}
