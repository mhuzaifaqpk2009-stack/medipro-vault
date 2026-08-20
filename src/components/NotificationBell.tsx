import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Trash2, Pill, UserPlus, ShoppingCart, AlertTriangle, Search, RotateCcw, Truck, Users, ShieldAlert, FileText, BellRing, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNotificationStore, type NotificationItem } from "@/store/notification-store";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { unreadMessages } from "@/lib/messages";
import { NOTIFICATION_LABELS } from "@/lib/notification-types";
import { money } from "@/lib/format";

const ICONS: Record<string, typeof Bell> = {
  messageReceived: MessageSquare, saleCompleted: ShoppingCart, forceSale: AlertTriangle, largeSale: AlertTriangle,
  medicineAdd: Pill, medicineEdit: Pill, medicineDelete: Pill, medicineLowStock: Pill, medicineOutOfStock: Pill,
  customerAdd: UserPlus, customerEdit: Users, customerDelete: Users, customerPayment: Users,
  purchaseAdd: Truck, purchaseEdit: Truck, purchaseDelete: Truck, purchaseReturned: RotateCcw, saleReturned: RotateCcw,
  syncConflict: ShieldAlert, dataSaveFailed: ShieldAlert, prescriptionAdd: FileText, prescriptionEdit: FileText,
  prescriptionDelete: FileText, prescriptionDueSoon: BellRing, prescriptionDueToday: BellRing,
  prescriptionVisitLoaded: ShoppingCart, prescriptionMedicineOutOfStock: AlertTriangle, prescriptionVisibilityChanged: ShieldAlert,
};

function priorityLabel(priority?: string) {
  if (priority === "urgent") return "🔴 Urgent";
  if (priority === "important") return "🟡 Important";
  return "🟢 Normal";
}
function summarize(n: NotificationItem, sym: string) {
  if (n.type === "messageReceived") return `${n.username} sent you a message`;
  const label = NOTIFICATION_LABELS[n.type] ?? n.type;
  if (n.type === "saleCompleted") return `${n.username} completed a sale of ${money(n.price ?? 0, sym)}`;
  if (n.type === "largeSale") return `${n.username} made a large sale of ${money(n.price ?? 0, sym)}`;
  if (n.type === "forceSale") return `${n.username} force-sold ${n.quantity ?? 0} × "${n.medicineName ?? "item"}"`;
  if (n.medicineName) return `${n.username}: ${label} — "${n.medicineName}"`;
  return `${n.username}: ${label}`;
}

export function NotificationBell() {
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const data = useProjectStore((s) => s.data);
  const allItems = useNotificationStore((s) => s.items);
  const remove = useNotificationStore((s) => s.remove);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const sym = data?.settings.currencySymbol || "$";
  const messageUnread = unreadMessages(data, user?.id).length;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<NotificationItem | null>(null);
  const [query, setQuery] = useState("");
  const items = useMemo(() => user ? allItems.filter((n) => n.recipientUserId === user.id || (!n.recipientUserId && user.role === "admin")) : [], [allItems, user]);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return items; return items.filter((n) => `${NOTIFICATION_LABELS[n.type] ?? n.type} ${n.username} ${n.medicineName ?? ""} ${n.details ?? ""} ${n.priority ?? ""}`.toLowerCase().includes(q)); }, [items, query]);
  const allowed = !!user && (user.role === "admin" || user.permissions.viewNotifications === true || messageUnread > 0);
  if (!allowed) return null;
  const unread = items.filter((i) => !i.read).length + messageUnread;
  const openMessage = (id: string) => { try { sessionStorage.setItem("medicore.focus-message", id); } catch {} navigate({ to: "/app/messages" }); };

  return <>
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v && user) markAllRead(user.id); }}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" title="Notifications"><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(420px,calc(100vw-24px))] p-0">
        <div className="border-b px-4 py-3"><div className="flex items-center justify-between"><span className="font-display text-sm font-semibold">Notifications</span>{items.length > 0 && user && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => clearAll(user.id)}>Clear all</Button>}</div><div className="relative mt-2"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notifications…" className="h-8 pl-8 text-xs" /></div></div>
        <ScrollArea className="h-[min(480px,60vh)]">{filtered.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{items.length ? "No matching notifications." : messageUnread ? "You have unread messages." : "Nothing yet."}</p> : <div className="divide-y">{filtered.map((n) => { const Icon = ICONS[n.type] ?? Bell; return <div key={n.id} className="group flex cursor-pointer items-start gap-3 px-4 py-3 text-sm hover:bg-accent" onClick={() => { markRead(n.id); setOpen(false); if (n.type === "messageReceived") openMessage(n.entityId); else setTimeout(() => setDetail(n), 0); }}>
          {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}<Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate">{summarize(n, sym)}</p><p className="text-xs text-muted-foreground">Sent by {n.username} · {new Date(n.timestamp).toLocaleString()}</p>{n.type === "messageReceived" && <><p className="mt-1 text-[11px] font-medium">{priorityLabel(n.priority)}</p>{n.details && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{n.details}</p>}</>}</div><button className="shrink-0 rounded p-1 opacity-0 hover:bg-muted group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); remove(n.id); }} title="Delete"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
        </div>; })}</div>}</ScrollArea>
      </PopoverContent>
    </Popover>
    <NotificationDetailDialog notification={detail} onClose={() => setDetail(null)} onDelete={remove} onOpenMessage={openMessage} />
  </>;
}

function NotificationDetailDialog({ notification, onClose, onDelete, onOpenMessage }: { notification: NotificationItem | null; onClose: () => void; onDelete: (id: string) => void; onOpenMessage: (id: string) => void }) {
  const data = useProjectStore((s) => s.data);
  const sym = data?.settings.currencySymbol || "$";
  const sale = notification && (notification.type === "saleCompleted" || notification.type === "forceSale" || notification.type === "largeSale") ? data?.sales.find((s) => s.id === notification.entityId) : null;
  return <Dialog open={!!notification} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">{notification && <><DialogHeader><DialogTitle>{summarize(notification, sym)}</DialogTitle></DialogHeader><div className="-mt-2 space-y-1 text-xs text-muted-foreground"><p>Sent by: {notification.username}</p><p>Time: {new Date(notification.timestamp).toLocaleString()}</p>{notification.type === "messageReceived" && <p>Priority: {priorityLabel(notification.priority)}</p>}</div>{notification.type === "messageReceived" && <div className="mt-3 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{notification.details}</div>}{notification.type === "messageReceived" && <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => { onClose(); onOpenMessage(notification.entityId); }}>Open message</Button></div>}{notification.type === "forceSale" && <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium text-warning">Forced sale</p><p>{notification.quantity ?? 0} unit(s) of {notification.medicineName ?? "the item"} were sold beyond available stock.</p></div>}{sale && <div className="mt-2"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Name</th><th className="pb-2 text-right font-medium">Qty</th><th className="pb-2 text-right font-medium">Price</th></tr></thead><tbody>{sale.items.map((it, i) => { const med = data?.medicines.find((m) => m.id === it.medicineId); return <tr key={i} className="border-b last:border-0"><td className="py-1.5">{med?.name ?? "—"}</td><td className="py-1.5 text-right tabular-nums">{it.quantity}</td><td className="py-1.5 text-right tabular-nums">{money(it.salePrice, sym)}</td></tr>; })}</tbody></table></div>}{notification.details && notification.type !== "messageReceived" && <p className="mt-3 rounded-md bg-muted p-3 text-sm">{notification.details}</p>}<div className="mt-4 flex justify-end"><Button variant="outline" size="sm" onClick={() => { onDelete(notification.id); onClose(); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete notification</Button></div></>}</DialogContent></Dialog>;
}
