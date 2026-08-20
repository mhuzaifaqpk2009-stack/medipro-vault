import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, PackageCheck, RotateCcw, ShoppingCart, WalletCards, Workflow, Sparkles, ListTodo, X, AlertTriangle, Clock3, Pencil, Plus, Trash2, Save, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/store/session-store";
import { useProjectStore } from "@/store/project-store";
import type { UserPermissions } from "@/lib/users";
import { runQuickAction } from "@/lib/quick-actions";
import { toast } from "sonner";

type RoutePath = "/app/sales" | "/app/purchases" | "/app/stocktake" | "/app/operations" | "/app/reports" | "/app/medicines" | "/app/messages" | "/app/customers" | "/app/suppliers";
type Step = { id: string; label: string; to: RoutePath; action?: "new-purchase" | "new-medicine" | "new-customer" | "new-supplier"; actionLabel?: string };
type Flow = { id: string; title: string; description: string; permission: keyof UserPermissions; steps: Step[]; custom?: boolean };
type Intent = { id: string; title: string; description: string; priority: "urgent" | "high" | "normal"; to: RoutePath; permission?: keyof UserPermissions; source?: string };
type Progress = { step: number; startedAt: string; updatedAt: string };
type HistoryEntry = { id: string; flowId: string; flowTitle: string; userId?: string; username?: string; startedAt: string; completedAt: string; steps: number };

const routeOptions: { to: RoutePath; label: string }[] = [
  { to: "/app/sales", label: "Sales / POS" }, { to: "/app/purchases", label: "Purchases" }, { to: "/app/stocktake", label: "Stock Take" },
  { to: "/app/operations", label: "Pharmacy Operations" }, { to: "/app/reports", label: "Reports" }, { to: "/app/medicines", label: "Medicines" },
  { to: "/app/messages", label: "Messages" }, { to: "/app/customers", label: "Customers" }, { to: "/app/suppliers", label: "Suppliers" },
];
const permissionOptions: { key: keyof UserPermissions; label: string }[] = [
  { key: "sales", label: "Sales" }, { key: "purchases", label: "Purchases" }, { key: "stocktake", label: "Stock Take" }, { key: "operations", label: "Operations" }, { key: "reports", label: "Reports" },
];
const DEFAULT_FLOWS: Flow[] = [
  { id: "sale", title: "Fast Sale", description: "Move from POS opening through checkout and receipt.", permission: "sales", steps: [
    { id: "sale-1", label: "Open POS", to: "/app/sales" }, { id: "sale-2", label: "Add medicines", to: "/app/sales" }, { id: "sale-3", label: "Customer / payment", to: "/app/sales" }, { id: "sale-4", label: "Finish and receipt", to: "/app/sales" },
  ] },
  { id: "purchase", title: "Receive Purchase", description: "Create or receive a purchase, then verify stock and supplier payable work.", permission: "purchases", steps: [
    { id: "purchase-1", label: "Open Purchases", to: "/app/purchases" }, { id: "purchase-2", label: "Create new purchase", to: "/app/purchases", action: "new-purchase", actionLabel: "New purchase" }, { id: "purchase-3", label: "Receive quantities / batches", to: "/app/operations" }, { id: "purchase-4", label: "Confirm inventory", to: "/app/operations" },
  ] },
  { id: "stocktake", title: "Stock Take", description: "Count physical stock, review differences and post the reconciliation.", permission: "stocktake", steps: [
    { id: "stocktake-1", label: "Open Stock Take", to: "/app/stocktake" }, { id: "stocktake-2", label: "Count / scan", to: "/app/stocktake" }, { id: "stocktake-3", label: "Review differences", to: "/app/stocktake" }, { id: "stocktake-4", label: "Apply reconciliation", to: "/app/stocktake" },
  ] },
  { id: "return", title: "Returns", description: "Review the original transaction, quantities and return confirmation.", permission: "operations", steps: [
    { id: "return-1", label: "Open Returns", to: "/app/operations" }, { id: "return-2", label: "Select original transaction", to: "/app/operations" }, { id: "return-3", label: "Select quantities", to: "/app/operations" }, { id: "return-4", label: "Confirm return", to: "/app/operations" },
  ] },
  { id: "closing", title: "Daily Closing", description: "Review cash, finance and outstanding work before closing the day.", permission: "operations", steps: [
    { id: "closing-1", label: "Open Finance", to: "/app/operations" }, { id: "closing-2", label: "Check expected cash", to: "/app/operations" }, { id: "closing-3", label: "Review expenses / ledgers", to: "/app/operations" }, { id: "closing-4", label: "Confirm daily close", to: "/app/operations" },
  ] },
];
const BASE_INTENTS: Intent[] = [
  { id: "stocktake", title: "Review physical stock", description: "Start or continue a physical inventory reconciliation.", priority: "high", to: "/app/stocktake", permission: "stocktake", source: "workflow" },
  { id: "receiving", title: "Finish receiving work", description: "Continue purchase receiving and confirm quantities and batches.", priority: "high", to: "/app/purchases", permission: "purchases", source: "workflow" },
  { id: "returns", title: "Review returns", description: "Check pending return work and keep stock and transactions synchronized.", priority: "normal", to: "/app/operations", permission: "operations", source: "workflow" },
  { id: "closing", title: "Prepare daily closing", description: "Review finance, cash and outstanding operational work.", priority: "normal", to: "/app/operations", permission: "operations", source: "workflow" },
  { id: "sales", title: "Open the sales desk", description: "Continue customer sales using the POS workflow.", priority: "normal", to: "/app/sales", permission: "sales", source: "workflow" },
  { id: "reports", title: "Review today's performance", description: "Inspect sales, purchases and profit reports.", priority: "normal", to: "/app/reports", permission: "reports", source: "workflow" },
];

function iconFor(id: string) { if (id === "sale") return ShoppingCart; if (id === "purchase") return PackageCheck; if (id === "stocktake") return ClipboardCheck; if (id === "return") return RotateCcw; if (id === "closing") return WalletCards; return Workflow; }
function readFlows(settings: any): Flow[] { const stored = settings?.workflowDefinitions; return Array.isArray(stored) && stored.length ? stored as Flow[] : DEFAULT_FLOWS; }
function readProgress(settings: any): Record<string, Progress> { return settings?.workflowProgress && typeof settings.workflowProgress === "object" ? settings.workflowProgress : {}; }
function readHistory(settings: any): HistoryEntry[] { return Array.isArray(settings?.workflowHistory) ? settings.workflowHistory : []; }

export const Route = createFileRoute("/app/workflows")({ component: WorkflowCenter });

function WorkflowCenter() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const project = useProjectStore((s) => s.data);
  const mutate = useProjectStore((s) => s.mutate);
  const isAdmin = user?.role === "admin";
  const flows = useMemo(() => readFlows(project?.settings), [project]);
  const available = useMemo(() => flows.filter((f) => isAdmin || Boolean(user?.permissions?.[f.permission])), [flows, isAdmin, user]);
  const [mode, setMode] = useState<"suggested" | "queue" | "history" | "builder">("suggested");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activeId, setActiveId] = useState(available[0]?.id ?? "");
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const active = available.find((f) => f.id === activeId) ?? available[0];
  const progress = readProgress(project?.settings);
  const history = readHistory(project?.settings);
  const current = active ? progress[`${user?.id ?? "anonymous"}:${active.id}`]?.step ?? 0 : 0;

  const allowed = (intent: Intent) => isAdmin || !intent.permission || Boolean(user?.permissions?.[intent.permission]);
  const liveIntents = useMemo<Intent[]>(() => {
    const now = Date.now(); const settings: any = project?.settings; const generated: Intent[] = [];
    const medicines = project?.medicines ?? []; const batches = settings?.inventoryBatches ?? [];
    const low = medicines.filter((m) => m.stockQuantity <= m.minimumStock && m.minimumStock > 0);
    if (low.length) generated.push({ id: "live-low-stock", title: `${low.length} medicine${low.length === 1 ? "" : "s"} need reordering`, description: `${low.length} item${low.length === 1 ? " is" : "s are"} at or below minimum stock.`, priority: low.length >= 5 ? "high" : "normal", to: "/app/medicines", permission: "medicines", source: "inventory" });
    const expiring = batches.filter((b: any) => { if (!b.expiryDate || b.quantity <= 0) return false; const t = new Date(b.expiryDate).getTime(); return Number.isFinite(t) && t <= now + 30 * 86400000; });
    if (expiring.length) generated.push({ id: "live-expiry", title: `${expiring.length} batch${expiring.length === 1 ? "" : "es"} need expiry review`, description: "Open batch operations to review expired and soon-to-expire stock.", priority: "urgent", to: "/app/operations", permission: "operations", source: "expiry" });
    const overdue = (settings?.purchaseInvoices ?? []).filter((i: any) => i.balance > 0 && i.dueDate && new Date(i.dueDate).getTime() < now && i.status !== "cancelled");
    if (overdue.length) generated.push({ id: "live-payables", title: `${overdue.length} supplier invoice${overdue.length === 1 ? "" : "s"} overdue`, description: `Supplier payable work needs attention${overdue[0]?.invoiceNumber ? ` — invoice ${overdue[0].invoiceNumber}` : ""}.`, priority: "high", to: "/app/operations", permission: "operations", source: "payables" });
    const grn = (settings?.goodsReceipts ?? []).filter((g: any) => g.status === "draft");
    if (grn.length) generated.push({ id: "live-grn", title: `${grn.length} GRN${grn.length === 1 ? "" : "s"} awaiting posting`, description: "Draft goods receipts still need quantities and batch confirmation.", priority: "high", to: "/app/operations", permission: "operations", source: "receiving" });
    const takes = (settings?.stockTakes ?? []).filter((s: any) => s.status === "draft");
    if (takes.length) generated.push({ id: "live-stocktake", title: `${takes.length} stock take${takes.length === 1 ? "" : "s"} still open`, description: "Finish the physical count and reconciliation.", priority: "high", to: "/app/stocktake", permission: "stocktake", source: "stocktake" });
    const unread = (project?.messages ?? []).filter((m) => m.toUserId === user?.id && !m.readAt).length;
    if (unread) generated.push({ id: "live-messages", title: `${unread} unread pharmacy message${unread === 1 ? "" : "s"}`, description: "New internal messages are waiting for you.", priority: "high", to: "/app/messages", permission: "messages", source: "messages" });
    return [...generated, ...BASE_INTENTS];
  }, [project, user]);

  const queue = useMemo(() => liveIntents.filter((i) => allowed(i) && !dismissed.includes(i.id)).sort((a, b) => { const rank = (p: Intent["priority"]) => p === "urgent" ? 0 : p === "high" ? 1 : 2; return rank(a.priority) - rank(b.priority) || (a.source === "workflow" ? 1 : -1); }), [liveIntents, dismissed, user, isAdmin]);
  const suggestion = useMemo(() => { if (!active) return null; const live = liveIntents.filter((i) => allowed(i) && !dismissed.includes(i.id) && i.source !== "workflow").sort((a,b) => (a.priority === "urgent" ? 0 : a.priority === "high" ? 1 : 2) - (b.priority === "urgent" ? 0 : b.priority === "high" ? 1 : 2))[0]; const step = active.steps[current]; if (live) return { title: live.title, description: live.description, to: live.to, live: true }; return step ? { title: step.label, description: `Continue ${active.title} from this step.`, to: step.to, action: step.action, live: false } : null; }, [active, current, liveIntents, dismissed, user, isAdmin]);

  function persistProgress(flow: Flow, step: number, complete = false) {
    if (!user) return;
    const key = `${user.id}:${flow.id}`; const now = new Date().toISOString();
    mutate((d) => {
      const s: any = d.settings; const p = { ...(s.workflowProgress ?? {}) }; const old = p[key]; p[key] = { step, startedAt: old?.startedAt ?? now, updatedAt: now }; s.workflowProgress = p;
      if (complete) { const h: HistoryEntry[] = Array.isArray(s.workflowHistory) ? s.workflowHistory : []; s.workflowHistory = [{ id: crypto.randomUUID(), flowId: flow.id, flowTitle: flow.title, userId: user.id, username: user.username, startedAt: old?.startedAt ?? now, completedAt: now, steps: flow.steps.length }, ...h].slice(0, 500); }
    });
  }
  function resetFlow(flow: Flow) { persistProgress(flow, 0); toast.success("Workflow progress reset"); }
  function markNext() { if (!active) return; const next = Math.min(current + 1, active.steps.length); persistProgress(active, next, next >= active.steps.length); if (next >= active.steps.length) toast.success(`${active.title} completed and recorded in workflow history`); }
  function openStep(step: Step) { if (step.action) { runQuickAction(step.action, navigate as any); return; } window.location.href = step.to; }
  function saveFlow(flow: Flow) { const cleaned = { ...flow, title: flow.title.trim() || "Untitled workflow", description: flow.description.trim(), steps: flow.steps.filter((s) => s.label.trim()).map((s, i) => ({ ...s, id: s.id || `${flow.id}-${i}-${Date.now()}` })) }; if (!cleaned.steps.length) { toast.error("A workflow needs at least one step"); return; } mutate((d) => { const s: any = d.settings; const existing = readFlows(s).filter((f) => f.id !== cleaned.id); s.workflowDefinitions = [...existing, { ...cleaned, custom: true }]; }); setEditingFlow(null); toast.success("Workflow saved"); }
  function newFlow() { setEditingFlow({ id: `custom-${Date.now()}`, title: "", description: "", permission: "operations", steps: [{ id: `step-${Date.now()}`, label: "", to: "/app/operations" }], custom: true }); }
  function deleteFlow(id: string) { if (!isAdmin) return; if (!window.confirm("Delete this workflow? Existing history is kept.")) return; mutate((d) => { const s: any = d.settings; s.workflowDefinitions = readFlows(s).filter((f) => f.id !== id); }); if (activeId === id) setActiveId(available.find((f) => f.id !== id)?.id ?? ""); toast.success("Workflow deleted"); }

  if (!user || (!isAdmin && available.length === 0)) return <div className="mx-auto max-w-4xl p-8"><div className="surface-card p-10 text-center"><Workflow className="mx-auto h-9 w-9 text-primary" /><h1 className="mt-3 font-display text-2xl font-bold">Workflow Engine</h1><p className="mt-2 text-sm text-muted-foreground">Your account has no workflow permission yet. Ask an administrator to enable Sales, Purchases, Stock Take, Operations or Reports access.</p></div></div>;
  const Icon = active ? iconFor(active.id) : Workflow;

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <div className="mb-6 flex items-start gap-3"><Workflow className="mt-1 h-7 w-7 text-primary" /><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Phases 2–4</p><h1 className="font-display text-3xl font-bold">Workflow Engine</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Persistent workflows, context-aware actions and a prioritized intent queue. Progress survives refresh and logout because it is stored with the pharmacy project.</p></div></div>
    <div className="mb-5 flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-1 w-fit">
      <Button variant={mode === "suggested" ? "default" : "ghost"} size="sm" onClick={() => setMode("suggested")}><Sparkles className="mr-2 h-4 w-4" />Suggested next</Button>
      <Button variant={mode === "queue" ? "default" : "ghost"} size="sm" onClick={() => setMode("queue")}><ListTodo className="mr-2 h-4 w-4" />Intent Queue ({queue.length})</Button>
      <Button variant={mode === "history" ? "default" : "ghost"} size="sm" onClick={() => setMode("history")}><History className="mr-2 h-4 w-4" />History ({history.length})</Button>
      {isAdmin && <Button variant={mode === "builder" ? "default" : "ghost"} size="sm" onClick={() => setMode("builder")}><Pencil className="mr-2 h-4 w-4" />Workflow Builder</Button>}
    </div>

    {mode === "suggested" && suggestion && <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-3">{suggestion.live ? <AlertTriangle className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}<div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{suggestion.live ? "Suggested from live pharmacy data" : "Suggested next action"}</p><p className="mt-1 font-semibold">{suggestion.title}</p><p className="text-sm text-muted-foreground">{suggestion.description}</p></div><Button size="sm" onClick={() => { if (suggestion.action) runQuickAction(suggestion.action, navigate as any); else if (suggestion.to) window.location.href = suggestion.to; }}>Open <ArrowRight className="ml-1 h-4 w-4" /></Button></div></div>}

    {mode === "queue" && <div className="mb-6 space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold">Intent Queue</h2><p className="text-sm text-muted-foreground">Live inventory, expiry, receiving, payable and message signals are prioritized before generic reminders.</p></div><Button variant="outline" size="sm" onClick={() => setDismissed([])}>Restore all</Button></div>{queue.length === 0 ? <div className="surface-card p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-primary" /><p className="mt-2 font-medium">Nothing needs your attention.</p></div> : queue.map((intent) => <div key={intent.id} className="surface-card flex items-center gap-4 p-4"><div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${intent.priority === "high" ? "bg-amber-100 text-amber-800" : intent.priority === "urgent" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>{intent.priority}</div>{intent.source !== "workflow" && <Clock3 className="h-4 w-4 text-primary" aria-label="Live pharmacy signal" />}<div className="min-w-0 flex-1"><p className="font-medium">{intent.title}</p><p className="text-sm text-muted-foreground">{intent.description}</p></div><a href={intent.to}><Button size="sm">Open <ArrowRight className="ml-1 h-4 w-4" /></Button></a><Button variant="ghost" size="icon" onClick={() => setDismissed((v) => [...v, intent.id])}><X className="h-4 w-4" /></Button></div>)}</div>}

    {mode === "history" && <div className="surface-card mb-6 overflow-hidden"><div className="border-b p-5"><h2 className="font-display text-xl font-semibold">Workflow history</h2><p className="text-sm text-muted-foreground">Who completed which workflow and when. History is saved with the pharmacy project.</p></div>{history.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No completed workflows yet.</p> : <div className="divide-y">{history.map((h) => <div key={h.id} className="flex flex-wrap items-center gap-4 p-4"><CheckCircle2 className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium">{h.flowTitle}</p><p className="text-xs text-muted-foreground">{h.username ?? "Unknown user"} · {new Date(h.completedAt).toLocaleString()} · {h.steps} steps</p></div></div>)}</div>}</div>}

    {mode === "builder" && isAdmin && <div className="mb-6 grid gap-5 lg:grid-cols-[320px,1fr]"><div className="surface-card p-3"><div className="flex items-center justify-between px-2 pb-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editable workflows</p><Button size="sm" variant="outline" onClick={newFlow}><Plus className="mr-1 h-3 w-3" />New</Button></div>{flows.map((f) => <button key={f.id} onClick={() => setEditingFlow(structuredClone(f))} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted"><Pencil className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1"><b className="block text-sm">{f.title}</b><span className="text-xs text-muted-foreground">{f.steps.length} steps · {f.permission}</span></span></button>)}</div><div className="surface-card p-6">{editingFlow ? <FlowEditor flow={editingFlow} setFlow={setEditingFlow} onSave={() => saveFlow(editingFlow)} onDelete={() => deleteFlow(editingFlow.id)} /> : <div className="p-8 text-center text-sm text-muted-foreground"><Pencil className="mx-auto mb-2 h-7 w-7" />Select a workflow or create a new one.</div>}</div></div>}

    {mode !== "builder" && <div className="grid gap-5 lg:grid-cols-[300px,1fr]"><div className="surface-card p-3"><p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflows</p>{available.map((f) => { const I=iconFor(f.id); const p=progress[`${user.id}:${f.id}`]?.step ?? 0; return <button key={f.id} onClick={() => setActiveId(f.id)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ${f.id===active?.id?"bg-primary/10 text-primary":"hover:bg-muted"}`}><I className="h-5 w-5" /><span className="min-w-0"><b className="block text-sm">{f.title}</b><span className="text-xs text-muted-foreground">{Math.min(p,f.steps.length)}/{f.steps.length} steps</span></span></button>; })}</div><div className="surface-card p-6">{active ? <><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><Icon className="mt-1 h-6 w-6 text-primary" /><div><h2 className="font-display text-xl font-semibold">{active.title}</h2><p className="mt-1 text-sm text-muted-foreground">{active.description}</p></div></div><Button variant="outline" size="sm" onClick={() => resetFlow(active)}>Reset progress</Button></div><div className="mt-6 space-y-3">{active.steps.map((s,i)=>{const done=i<current;const cur=i===current;return <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-3 ${cur?"border-primary bg-primary/5":""}`}><div className={`grid h-8 w-8 place-items-center rounded-full border ${done?"border-primary bg-primary text-primary-foreground":""}`}>{done?<CheckCircle2 className="h-4 w-4"/>:<span className="text-xs font-bold">{i+1}</span>}</div><div className="min-w-0 flex-1"><p className={`text-sm font-medium ${done?"line-through text-muted-foreground":""}`}>{s.label}</p>{cur&&<p className="text-xs text-muted-foreground">Current step{ s.actionLabel ? ` · ${s.actionLabel}` : ""}</p>}</div>{cur&&<Button size="sm" onClick={()=>openStep(s)}>Open <ArrowRight className="ml-1 h-4 w-4"/></Button>}</div>})}</div><div className="mt-6 flex items-center justify-between border-t pt-4"><p className="text-xs text-muted-foreground">{current>=active.steps.length?"Workflow complete — recorded in history.":`Step ${current+1} of ${active.steps.length}`}</p>{current<active.steps.length?<Button onClick={markNext}>{current===active.steps.length-1?"Complete workflow":"Mark step complete"}<CheckCircle2 className="ml-2 h-4 w-4"/></Button>:<Button onClick={()=>resetFlow(active)}>Start again</Button>}</div></>:<p className="p-8 text-center text-sm text-muted-foreground">No workflow is available for your permissions.</p>}</div></div>}
  </div>;
}

function FlowEditor({ flow, setFlow, onSave, onDelete }: { flow: Flow; setFlow: (f: Flow) => void; onSave: () => void; onDelete: () => void }) {
  const updateStep = (index: number, patch: Partial<Step>) => setFlow({ ...flow, steps: flow.steps.map((s,i) => i===index ? { ...s, ...patch } : s) });
  return <div><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold">Workflow Builder</h2><p className="text-sm text-muted-foreground">Admins can create or edit pharmacy-specific workflows.</p></div><div className="flex gap-2"><Button variant="outline" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4"/>Delete</Button><Button onClick={onSave}><Save className="mr-1 h-4 w-4"/>Save workflow</Button></div></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-medium">Name</label><Input value={flow.title} onChange={e=>setFlow({...flow,title:e.target.value})}/></div><div><label className="text-xs font-medium">Permission required</label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={flow.permission} onChange={e=>setFlow({...flow,permission:e.target.value as keyof UserPermissions})}>{permissionOptions.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></div></div><div className="mt-3"><label className="text-xs font-medium">Description</label><Textarea value={flow.description} onChange={e=>setFlow({...flow,description:e.target.value})}/></div><div className="mt-5 space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Steps</h3><Button size="sm" variant="outline" onClick={()=>setFlow({...flow,steps:[...flow.steps,{id:`step-${Date.now()}`,label:"",to:"/app/operations"}]})}><Plus className="mr-1 h-3 w-3"/>Add step</Button></div>{flow.steps.map((s,i)=><div key={s.id} className="rounded-lg border p-3"><div className="mb-2 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-bold">{i+1}</span><Input className="flex-1" placeholder="Step name" value={s.label} onChange={e=>updateStep(i,{label:e.target.value})}/><Button size="icon" variant="ghost" onClick={()=>setFlow({...flow,steps:flow.steps.filter((_,k)=>k!==i)})}><Trash2 className="h-4 w-4 text-destructive"/></Button></div><div className="grid gap-2 sm:grid-cols-2"><select className="h-9 rounded-md border bg-background px-2 text-sm" value={s.to} onChange={e=>updateStep(i,{to:e.target.value as RoutePath})}>{routeOptions.map(r=><option key={r.to} value={r.to}>{r.label}</option>)}</select><select className="h-9 rounded-md border bg-background px-2 text-sm" value={s.action ?? "none"} onChange={e=>updateStep(i,{action:e.target.value === "none" ? undefined : e.target.value as Step["action"], actionLabel:e.target.value === "none" ? undefined : ({"new-purchase":"New purchase","new-medicine":"New medicine","new-customer":"New customer","new-supplier":"New supplier"} as any)[e.target.value]})}><option value="none">Open page</option><option value="new-purchase">New purchase</option><option value="new-medicine">New medicine</option><option value="new-customer">New customer</option><option value="new-supplier">New supplier</option></select></div></div>)}</div></div>;
}
