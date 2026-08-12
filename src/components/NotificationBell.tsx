import { useState } from "react";
import { Bell, Trash2, X, Pill, UserPlus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNotificationStore, type NotificationItem } from "@/store/notification-store";
import { useProjectStore } from "@/store/project-store";
import { money } from "@/lib/format";

const ICONS: Record<NotificationItem["type"], typeof Bell> = {
  sale: ShoppingCart,
  medicineDelete: Pill,
  medicineAdd: Pill,
  customerAdd: UserPlus,
};

function summarize(n: NotificationItem, sym: string): string {
  if (n.type === "sale") return `${n.username} made a sale of ${money(n.price ?? 0, sym)}`;
  if (n.type === "medicineDelete") return `${n.username} deleted medicine "${n.medicineName ?? "?"}"`;
  if (n.type === "medicineAdd") return `${n.username} added medicine "${n.medicineName ?? "?"}"`;
  return `${n.username} added customer "${n.medicineName ?? "?"}"`;
}

/** Bell icon + side panel (YouTube-style) for admin notifications.
 * Multi computer mode + admin only — caller decides visibility. */
export function NotificationBell() {
  const items = useNotificationStore((s) => s.items);
  const remove = useNotificationStore((s) => s.remove);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const sym = useProjectStore((s) => s.data?.settings.currencySymbol || "$");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<NotificationItem | null>(null);

  const unread = items.filter((i) => !i.read).length;

  return (
    <>
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" title="Notifications">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-display text-sm font-semibold">Notifications</span>
            {items.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>
          <ScrollArea className="h-[min(420px,60vh)]">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="divide-y">
                {items.map((n) => {
                  const Icon = ICONS[n.type];
                  return (
                    <div
                      key={n.id}
                      className="group flex cursor-pointer items-start gap-3 px-4 py-3 text-sm hover:bg-accent"
                      onClick={() => { markRead(n.id); setDetail(n); }}
                    >
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{summarize(n, sym)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(n.timestamp).toLocaleString()}</p>
                      </div>
                      <button
                        className="shrink-0 rounded p-1 opacity-0 hover:bg-muted group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                        title="Delete"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <NotificationDetailDialog notification={detail} onClose={() => setDetail(null)} onDelete={remove} />
    </>
  );
}

function NotificationDetailDialog({
  notification, onClose, onDelete,
}: { notification: NotificationItem | null; onClose: () => void; onDelete: (id: string) => void }) {
  const data = useProjectStore((s) => s.data);
  const sym = data?.settings.currencySymbol || "$";
  const sale = notification?.type === "sale" ? data?.sales.find((s) => s.id === notification.entityId) : null;

  return (
    <Dialog open={!!notification} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {notification && (
          <>
            <DialogHeader>
              <DialogTitle>{summarize(notification, sym)}</DialogTitle>
            </DialogHeader>
            <p className="-mt-2 text-xs text-muted-foreground">
              {new Date(notification.timestamp).toLocaleString()}
            </p>

            {notification.type === "sale" && (
              sale ? (
                <div className="mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 text-right font-medium">Qty</th>
                        <th className="pb-2 text-right font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items.map((it, i) => {
                        const med = data?.medicines.find((m) => m.id === it.medicineId);
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5">{med?.name ?? "—"}</td>
                            <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
                            <td className="py-1.5 text-right tabular-nums">{money(it.salePrice, sym)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">{sale.discount}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{sale.taxPercent}%</span></div>
                    <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{money(notification.price ?? 0, sym)}</span></div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This sale's full details aren't available on this computer (it may not have synced yet).</p>
              )
            )}

            {notification.type !== "sale" && (
              <div className="mt-2 space-y-1 text-sm">
                {notification.medicineName && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{notification.medicineName}</span></div>
                )}
                {notification.quantity !== undefined && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span className="tabular-nums">{notification.quantity}</span></div>
                )}
                {notification.price !== undefined && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="tabular-nums">{money(notification.price, sym)}</span></div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => { onDelete(notification.id); onClose(); }}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete notification
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
