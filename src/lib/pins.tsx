/**
 * Pin & rename system.
 *
 * Any button, counter or panel can be right-clicked to open a small dialog
 * offering "Pin to bottom bar" and (for admins) "Rename". Pinned items live in
 * project settings so they travel with the saved data / backups.
 */
import { useEffect, useRef, useState } from "react";
import { Pin, PinOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import type { PinnedItem, ProjectData } from "@/domain/schema";
import { daysUntil, money } from "@/lib/format";

export type MenuTarget = PinnedItem & { canRename?: boolean };

let openFn: ((t: MenuTarget) => void) | null = null;

/** Open the pin/rename dialog for an item. */
export function openItemMenu(target: MenuTarget) {
  openFn?.(target);
}

/** Handy right-click binder: <div {...pinContext({...})} /> */
export function pinContext(target: MenuTarget) {
  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openItemMenu(target);
    },
  };
}

export function isPinned(settings: ProjectData["settings"], id: string) {
  return (settings.pinnedItems ?? []).some((p) => p.id === id);
}

export function togglePin(item: PinnedItem) {
  const mutate = useProjectStore.getState().mutate;
  let pinned = false;
  mutate((d) => {
    const list = d.settings.pinnedItems ?? [];
    if (list.some((p) => p.id === item.id)) {
      d.settings.pinnedItems = list.filter((p) => p.id !== item.id);
    } else {
      d.settings.pinnedItems = [...list, { id: item.id, label: item.label, kind: item.kind, to: item.to }];
      pinned = true;
    }
  });
  return pinned;
}

export function renameTab(path: string, name: string) {
  useProjectStore.getState().mutate((d) => {
    const map = { ...(d.settings.tabRenames ?? {}) };
    if (name.trim()) map[path] = name.trim();
    else delete map[path];
    d.settings.tabRenames = map;
    // Keep pinned labels in sync.
    d.settings.pinnedItems = (d.settings.pinnedItems ?? []).map((p) =>
      p.id === path ? { ...p, label: name.trim() || p.label } : p,
    );
  });
}

/** Live value for a pinned dashboard counter. */
export function counterValue(data: ProjectData, id: string): string {
  const sym = data.settings.currencySymbol || "$";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const completed = data.sales.filter((s) => s.status === "completed");
  const total = (s: ProjectData["sales"][number]) => {
    const sub = s.items.reduce((a, l) => a + l.salePrice * l.quantity * (1 - l.discountPercent / 100), 0);
    return Math.max(0, sub + sub * (s.taxPercent / 100) - s.discount);
  };
  const profit = (s: ProjectData["sales"][number]) =>
    s.items.reduce((a, l) => {
      const m = data.medicines.find((x) => x.id === l.medicineId);
      return a + (l.salePrice * l.quantity * (1 - l.discountPercent / 100) - (m?.purchasePrice ?? 0) * l.quantity);
    }, 0);
  const since = (t: number, f: (s: any) => number) =>
    completed.filter((s) => new Date(s.date).getTime() >= t).reduce((a, s) => a + f(s), 0);

  switch (id) {
    case "counter:totalMedicines": return String(data.medicines.length);
    case "counter:lowStock":
      return String(data.medicines.filter((m) => m.stockQuantity <= (m.minimumStock ?? 0)).length);
    case "counter:expired":
      return String(data.medicines.filter((m) => {
        const d = daysUntil(m.expiryDate);
        return d !== null && d <= 0;
      }).length);
    case "counter:todayRevenue": return money(since(startOfDay, total), sym);
    case "counter:todayProfit": return money(since(startOfDay, profit), sym);
    case "counter:monthRevenue": return money(since(startOfMonth, total), sym);
    case "counter:customers": return String(data.customers.length);
    case "counter:suppliers": return String(data.suppliers.length);
    default: return "—";
  }
}

export function ItemMenuHost() {
  const [target, setTarget] = useState<MenuTarget | null>(null);
  const [name, setName] = useState("");
  const settings = useProjectStore((s) => s.data?.settings);
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    openFn = (t) => {
      setTarget(t);
      setName(settings?.tabRenames?.[t.id] ?? "");
    };
    return () => { openFn = null; };
  }, [settings]);

  if (!target || !settings) return null;
  const pinned = isPinned(settings, target.id);

  return (
    <Dialog open onOpenChange={(o) => !o && setTarget(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{target.label}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Button
            variant="outline"
            onClick={() => {
              const nowPinned = togglePin(target);
              toast.success(nowPinned ? "Pinned to bottom panel" : "Unpinned");
              setTarget(null);
            }}
          >
            {pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
            {pinned ? "Unpin from bottom panel" : "Pin to bottom panel"}
          </Button>

          {target.canRename && isAdmin && (
            <div className="rounded-md border p-3">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Rename</Label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  placeholder={target.label}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { renameTab(target.id, name); toast.success("Renamed"); setTarget(null); }
                  }}
                />
                <Button
                  onClick={() => { renameTab(target.id, name); toast.success("Renamed"); setTarget(null); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Leave blank and save to restore the original name.</p>
            </div>
          )}
          {target.canRename && !isAdmin && (
            <p className="text-xs text-muted-foreground">Renaming is available to admins only.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setTarget(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
