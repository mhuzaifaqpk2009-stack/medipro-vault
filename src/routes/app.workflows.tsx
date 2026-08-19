import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, PackageCheck, RotateCcw, ShoppingCart, WalletCards, Workflow, Sparkles, ListTodo, X, AlertTriangle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/store/session-store";
import { useProjectStore } from "@/store/project-store";
import { PermissionGate } from "@/components/PermissionGate";
import type { UserPermissions } from "@/lib/users";

type Step = { label: string; to?: "/app/sales" | "/app/purchases" | "/app/stocktake" | "/app/operations" | "/app/bills" };
type Flow = { id: string; title: string; description: string; icon: typeof ShoppingCart; permission: keyof UserPermissions; steps: Step[] };
type Intent = { id: string; title: string; description: string; priority: "urgent" | "high" | "normal"; to: "/app/sales" | "/app/purchases" | "/app/stocktake" | "/app/operations" | "/app/reports" | "/app/medicines"; permission?: keyof UserPermissions; source?: string };

const FLOWS: Flow[] = [
  { id: "sale", title: "Fast Sale", description: "Keep the sale moving from medicine selection through checkout and receipt.", icon: ShoppingCart, permission: "sales", steps: [{ label: "Open POS", to: "/app/sales" }, { label: "Add medicines", to: "/app/sales" }, { label: "Customer / payment", to: "/app/sales" }, { label: "Finish and receipt", to: "/app/sales" }] },
  { id: "purchase", title: "Receive Purchase", description: "Move from supplier purchase to receiving and inventory confirmation without losing context.", icon: PackageCheck, permission: "purchases", steps: [{ label: "Open Purchases", to: "/app/purchases" }, { label: "Confirm supplier", to: "/app/purchases" }, { label: "Receive quantities / batches", to: "/app/operations" }, { label: "Confirm inventory", to: "/app/operations" }] },
  { id: "stocktake", title: "Stock Take", description: "Count physical stock, reconcile differences, then return to normal operations.", icon: ClipboardCheck, permission: "stocktake", steps: [{ label: "Open Stock Take", to: "/app/stocktake" }, { label: "Count / scan", to: "/app/stocktake" }, { label: "Review differences", to: "/app/stocktake" }, { label: "Apply reconciliation", to: "/app/stocktake" }] },
  { id: "return", title: "Returns", description: "Process a customer or supplier return while keeping stock and transaction history connected.", icon: RotateCcw, permission: "operations", steps: [{ label: "Open Returns", to: "/app/operations" }, { label: "Select original transaction", to: "/app/operations" }, { label: "Select quantities", to: "/app/operations" }, { label: "Confirm return", to: "/app/operations" }] },
  { id: "closing", title: "Daily Closing", description: "Walk through cash, finance and outstanding work before closing the pharmacy day.", icon: WalletCards, permission: "operations", steps: [{ label: "Open Finance", to: "/app/operations" }, { label: "Check expected cash", to: "/app/operations" }, { label: "Review expenses / ledgers", to: "/app/operations" }, { label: "Confirm daily close", to: "/app/operations" }] },
];

const BASE_INTENTS: Intent[] = [
  { id: "stocktake", title: "Review physical stock", description: "Start a stock take when inventory needs a physical reconciliation.", priority: "high", to: "/app/stocktake", permission: "stocktake", source: "workflow" },
  { id: "receiving", title: "Finish receiving work", description: "Continue purchase receiving and confirm quantities and batches.", priority: "high", to: "/app/purchases", permission: "purchases", source: "workflow" },
  { id: "returns", title: "Review returns", description: "Check pending return work and keep stock and transactions synchronized.", priority: "normal", to: "/app/operations", permission: "operations", source: "workflow" },
  { id: "closing", title: "Prepare daily closing", description: "Review finance, cash and outstanding operational work before closing.", priority: "normal", to: "/app/operations", permission: "operations", source: "workflow" },
  { id: "sales", title: "Open the sales desk", description: "Continue customer sales using the fastest POS workflow.", priority: "normal", to: "/app/sales", permission: "sales", source: "workflow" },
  { id: "reports", title: "Review today's performance", description: "Open reports when you need to inspect sales, purchases or profit.", priority: "normal", to: "/app/reports", permission: "reports", source: "workflow" },
];

export const Route = createFileRoute("/app/workflows")({ component: () => <PermissionGate perm="sales"><WorkflowCenter /></PermissionGate> });

function WorkflowCenter() {
  const user = useSession((s) => s.user);
  const project = useProjectStore((s) => s.data);
  const location = useLocation();
  const [mode, setMode] = useState<"suggested" | "queue">("suggested");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const available = useMemo(() => FLOWS.filter((f) => user?.role === "admin" || Boolean(user?.permissions?.[f.permission])), [user]);
  const [activeId, setActiveId] = useState(available[0]?.id ?? "");
  const [completed, setCompleted] = useState<Record<string, number>>({});
  const active = available.find((f) => f.id === activeId) ?? available[0];
  const step = active ? completed[active.id] ?? 0 : 0;

  const allowed = (intent: Intent) => user?.role === "admin" || !intent.permission || Boolean(user?.permissions?.[intent.permission]);

  const liveIntents = useMemo<Intent[]>(() => {
    const now = Date.now();
    const settings = project?.settings;
    const generated: Intent[] = [];
    const medicines = project?.medicines ?? [];
    const batches = settings?.inventoryBatches ?? [];

    const lowStock = medicines.filter((m) => m.stockQuantity <= m.minimumStock && m.minimumStock > 0).length;
    if (lowStock > 0) generated.push({ id: "live-low-stock", title: `${lowStock} medicine${lowStock === 1 ? "" : "s"} need reordering`, description: "Stock is at or below the configured minimum. Review and reorder before the shelf runs out.", priority: lowStock >= 5 ? "high" : "normal", to: "/app/medicines", permission: "medicines", source: "inventory" });

    const expiring = batches.filter((b) => {
      if (!b.expiryDate || b.quantity <= 0) return false;
      const t = new Date(b.expiryDate).getTime();
      return Number.isFinite(t) && t <= now + 30 * 86400000;
    }).length;
    if (expiring > 0) generated.push({ id: "live-expiry", title: `${expiring} batch${expiring === 1 ? "" : "es"} need expiry review`, description: "Batches are expired or within 30 days of expiry. Review them before they become a sales or write-off problem.", priority: "urgent", to: "/app/operations", permission: "operations", source: "expiry" });

    const overdueInvoices = (settings?.purchaseInvoices ?? []).filter((i) => i.balance > 0 && i.dueDate && new Date(i.dueDate).getTime() < now && i.status !== "cancelled").length;
    if (overdueInvoices > 0) generated.push({ id: "live-payables", title: `${overdueInvoices} supplier invoice${overdueInvoices === 1 ? "" : "s"} overdue`, description: "Supplier balances have passed their due date. Review payable balances and schedule payment.", priority: "high", to: "/app/operations", permission: "operations", source: "payables" });

    const pendingGrn = (settings?.goodsReceipts ?? []).filter((g) => g.status === "draft").length;
    if (pendingGrn > 0) generated.push({ id: "live-grn", title: `${pendingGrn} GRN${pendingGrn === 1 ? "" : "s"} awaiting posting`, description: "Goods receipts are still in draft. Confirm quantities and batches so received stock is accounted for.", priority: "high", to: "/app/operations", permission: "operations", source: "receiving" });

    const openStockTakes = (settings?.stockTakes ?? []).filter((s) => s.status === "draft").length;
    if (openStockTakes > 0) generated.push({ id: "live-stocktake", title: `${openStockTakes} stock take${openStockTakes === 1 ? "" : "s"} still open`, description: "A physical count has not been posted yet. Finish the reconciliation to keep stock accurate.", priority: "high", to: "/app/stocktake", permission: "stocktake", source: "stocktake" });

    const unreadMessages = (project?.messages ?? []).filter((m) => m.toUserId === user?.id && !m.readAt).length;
    if (unreadMessages > 0) generated.push({ id: "live-messages", title: `${unreadMessages} unread pharmacy message${unreadMessages === 1 ? "" : "s"}`, description: "There are new internal messages waiting for you.", priority: "high", to: "/app/messages", permission: "messages", source: "messages" });

    return [...generated, ...BASE_INTENTS];
  }, [project, user]);

  const queue = useMemo(() => {
    const current = location.pathname;
    const visible = liveIntents.filter((i) => allowed(i) && !dismissed.includes(i.id));
    return [...visible].sort((a, b) => {
      const context = (id: string) => (current.includes(id) ? -10 : 0);
      const rank = (p: Intent["priority"]) => p === "urgent" ? 0 : p === "high" ? 1 : 2;
      const live = (i: Intent) => i.source !== "workflow" ? -2 : 0;
      return context(a.id) - context(b.id) || rank(a.priority) - rank(b.priority) || live(a) - live(b) || a.title.localeCompare(b.title);
    });
  }, [location.pathname, user, dismissed, liveIntents]);

  const suggestion = useMemo(() => {
    if (!active) return null;
    const currentStep = active.steps[step];
    const contextIntent = liveIntents.filter((i) => allowed(i) && !dismissed.includes(i.id)).sort((a, b) => (a.priority === "urgent" ? -1 : a.priority === "high" ? 0 : 1) - (b.priority === "urgent" ? -1 : b.priority === "high" ? 0 : 1))[0];
    if (contextIntent && contextIntent.source !== "workflow") return { title: contextIntent.title, description: contextIntent.description, to: contextIntent.to, live: true };
    if (currentStep) return { title: currentStep.label, description: `Continue ${active.title} from the current step.`, to: currentStep.to, live: false };
    return { title: `Start ${active.title}`, description: active.description, to: active.steps[0]?.to, live: false };
  }, [active, step, liveIntents, user, dismissed]);

  if (!active) return null;
  const Icon = active.icon;
  const next = () => setCompleted((v) => ({ ...v, [active.id]: Math.min(step + 1, active.steps.length) }));
  const reset = () => setCompleted((v) => ({ ...v, [active.id]: 0 }));

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <div className="mb-6 flex items-start gap-3"><Workflow className="mt-1 h-7 w-7 text-primary" /><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Phases 2–4</p><h1 className="font-display text-3xl font-bold">Workflow Engine</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Follow workflows, get context-aware actions from live pharmacy data, and keep important work in one prioritized queue.</p></div></div>

    <div className="mb-5 flex gap-2 rounded-lg border bg-muted/30 p-1 w-fit">
      <Button variant={mode === "suggested" ? "default" : "ghost"} size="sm" onClick={() => setMode("suggested")}><Sparkles className="mr-2 h-4 w-4" />Suggested next</Button>
      <Button variant={mode === "queue" ? "default" : "ghost"} size="sm" onClick={() => setMode("queue")}><ListTodo className="mr-2 h-4 w-4" />Intent Queue ({queue.length})</Button>
    </div>

    {mode === "suggested" && suggestion && <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-3">{suggestion.live ? <AlertTriangle className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}<div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{suggestion.live ? "Suggested from live pharmacy data" : "Suggested next action"}</p><p className="mt-1 font-semibold">{suggestion.title}</p><p className="text-sm text-muted-foreground">{suggestion.description}</p></div>{suggestion.to && <Link to={suggestion.to}><Button size="sm">Continue <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>}</div></div>}

    {mode === "queue" && <div className="mb-6 space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold">Intent Queue</h2><p className="text-sm text-muted-foreground">Live inventory, expiry, receiving, payable and message signals are prioritized before generic workflow reminders.</p></div><Button variant="outline" size="sm" onClick={() => setDismissed([])}>Restore all</Button></div>{queue.length === 0 ? <div className="surface-card p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-primary" /><p className="mt-2 font-medium">Nothing needs your attention.</p><p className="text-sm text-muted-foreground">Your accessible intent queue is clear.</p></div> : queue.map((intent) => <div key={intent.id} className="surface-card flex items-center gap-4 p-4"><div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${intent.priority === "high" ? "bg-amber-100 text-amber-800" : intent.priority === "urgent" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>{intent.priority}</div>{intent.source !== "workflow" && <Clock3 className="h-4 w-4 text-primary" aria-label="Live pharmacy signal" />}<div className="min-w-0 flex-1"><p className="font-medium">{intent.title}</p><p className="text-sm text-muted-foreground">{intent.description}</p></div><Link to={intent.to}><Button size="sm">Open <ArrowRight className="ml-1 h-4 w-4" /></Button></Link><Button variant="ghost" size="icon" aria-label="Dismiss intent" onClick={() => setDismissed((v) => [...v, intent.id])}><X className="h-4 w-4" /></Button></div>)}</div>}

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
