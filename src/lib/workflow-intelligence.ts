import type { UserPermissions } from "@/lib/users";

export type SmartPriority = "critical" | "urgent" | "high" | "normal";
export type SmartIssue = { id: string; title: string; detail: string; priority: SmartPriority; score: number; route: string; permission?: keyof UserPermissions; action?: string; group: string; evidence?: string[] };

const priorityWeight: Record<SmartPriority, number> = { critical: 1000, urgent: 800, high: 500, normal: 100 };

/** Pure decision engine used by workflow/command surfaces. It never mutates pharmacy data. */
export function rankSmartIssues(issues: SmartIssue[]) {
  return [...issues].sort((a, b) => (priorityWeight[b.priority] + b.score) - (priorityWeight[a.priority] + a.score));
}

export function buildSmartIssues(data: any, now = Date.now()): SmartIssue[] {
  const issues: SmartIssue[] = [];
  const medicines = Array.isArray(data?.medicines) ? data.medicines : [];
  const settings = data?.settings ?? {};
  const batches = Array.isArray(settings.inventoryBatches) ? settings.inventoryBatches : [];
  const low = medicines.filter((m: any) => Number(m.stockQuantity ?? 0) <= Number(m.minimumStock ?? 0) && Number(m.minimumStock ?? 0) > 0);
  if (low.length) issues.push({ id:"smart-low-stock", title:"Reorder low-stock medicines", detail:`${low.length} medicine${low.length===1?"":"s"} is at or below minimum stock.`, priority: low.some((m:any)=>Number(m.stockQuantity??0)<=0)?"urgent":"high", score:Math.min(low.length*8,80), route:"/app/medicines", permission:"medicines", action:"review-low-stock", group:"inventory", evidence:low.slice(0,8).map((m:any)=>m.name) });
  const expiry = batches.filter((b:any) => Number(b.quantity??0)>0 && b.expiryDate).map((b:any)=>({ ...b, t:new Date(b.expiryDate).getTime() })).filter((b:any)=>Number.isFinite(b.t) && b.t<=now+30*86400000);
  const expired = expiry.filter((b:any)=>b.t<now);
  if (expiry.length) issues.push({ id:"smart-expiry", title:expired.length?"Block and review expired stock":"Review approaching expiry", detail:`${expiry.length} batch${expiry.length===1?"":"es"} need expiry attention.`, priority:expired.length?"critical":"urgent", score:Math.min(expiry.length*10,100), route:"/app/operations", permission:"operations", action:"expiry-review", group:"inventory", evidence:expiry.slice(0,8).map((b:any)=>`${b.batchNumber??"Batch"} · ${b.expiryDate}`) });
  const overdue = (settings.purchaseInvoices ?? []).filter((i:any)=>Number(i.balance??0)>0 && i.dueDate && new Date(i.dueDate).getTime()<now && i.status!=="cancelled");
  if (overdue.length) issues.push({ id:"smart-payables", title:"Resolve overdue supplier payables", detail:`${overdue.length} supplier invoice${overdue.length===1?"":"s"} is overdue.`, priority:"urgent", score:Math.min(overdue.length*12,100), route:"/app/operations", permission:"operations", action:"supplier-payables", group:"finance", evidence:overdue.slice(0,8).map((i:any)=>`${i.invoiceNumber??"Invoice"} · balance ${i.balance}`) });
  const grns = (settings.goodsReceipts ?? []).filter((g:any)=>g.status==="draft");
  if (grns.length) issues.push({ id:"smart-grn", title:"Post pending GRNs", detail:`${grns.length} goods receipt${grns.length===1?"":"s"} remain in draft.`, priority:"high", score:grns.length*10, route:"/app/operations", permission:"operations", action:"grn-review", group:"receiving" });
  const takes = (settings.stockTakes ?? []).filter((s:any)=>s.status==="draft");
  if (takes.length) issues.push({ id:"smart-stocktake", title:"Finish open stock takes", detail:`${takes.length} stock take${takes.length===1?"":"s"} need completion.`, priority:"high", score:takes.length*10, route:"/app/stocktake", permission:"stocktake", action:"stocktake-review", group:"inventory" });
  const messages = Array.isArray(data?.messages) ? data.messages.filter((m:any)=>!m.readAt) : [];
  if (messages.length) issues.push({ id:"smart-messages", title:"Read pending messages", detail:`${messages.length} unread internal message${messages.length===1?"":"s"}.`, priority:"high", score:messages.length*4, route:"/app/messages", permission:"messages", action:"message-review", group:"communication" });
  return rankSmartIssues(issues);
}

export function nextBestAction(data: any, permissions: UserPermissions | undefined) {
  return buildSmartIssues(data).find((i) => !i.permission || Boolean(permissions?.[i.permission])) ?? null;
}
