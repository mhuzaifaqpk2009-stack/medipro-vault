/**
 * Pin & rename system.
 *
 * Right-clicking any button, counter or panel opens a small Windows-style
 * context menu at the cursor offering "Pin to bottom panel" / "Unpin" and
 * (for admins) "Rename". Pinned items live in project settings so they travel
 * with the saved data / backups.
 */
import { useEffect, useRef, useState } from "react";
import { Pin, PinOff, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import type { PinnedItem, ProjectData } from "@/domain/schema";
import { daysUntil, money } from "@/lib/format";
import { saleProfit, saleTotal } from "@/lib/sale-math";

export type MenuTarget = PinnedItem & { canRename?: boolean };
type Point = { x: number; y: number };

let openFn: ((t: MenuTarget, at: Point) => void) | null = null;

/** Open the pin/rename menu for an item at a screen position. */
export function openItemMenu(target: MenuTarget, at: Point) {
  openFn?.(target, at);
}

/** Handy right-click binder: <div {...pinContext({...})} /> */
export function pinContext(target: MenuTarget) {
  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openItemMenu(target, { x: e.clientX, y: e.clientY });
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

export function unpin(id: string) {
  useProjectStore.getState().mutate((d) => {
    d.settings.pinnedItems = (d.settings.pinnedItems ?? []).filter((p) => p.id !== id);
  });
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

/** Live value for a pinned counter. */
export function counterValue(data: ProjectData, id: string): string {
  const sym = data.settings.currencySymbol || "$";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const completed = data.sales.filter((s) => s.status === "completed");
  const since = (t: number, f: (s: ProjectData["sales"][number]) => number) =>
    completed.filter((s) => new Date(s.date).getTime() >= t).reduce((a, s) => a + f(s), 0);
  const expiringWithin = (days: number) =>
    data.medicines.filter((m) => {
      const d = daysUntil(m.expiryDate);
      return d !== null && d >= 0 && d <= days;
    }).length;

  switch (id) {
    case "counter:totalMedicines": return String(data.medicines.length);
    case "counter:lowStock":
      return String(data.medicines.filter((m) => m.stockQuantity <= (m.minimumStock ?? 0)).length);
    case "counter:outOfStock":
      return String(data.medicines.filter((m) => m.stockQuantity === 0).length);
    case "counter:nearExpiry": return String(expiringWithin(30));
    case "counter:expired":
      return String(data.medicines.filter((m) => {
        const d = daysUntil(m.expiryDate);
        return d !== null && d <= 0;
      }).length);
    case "counter:todayRevenue": return money(since(startOfDay, saleTotal), sym);
    case "counter:todayProfit":
      return money(since(startOfDay, (s) => saleProfit(s, data.medicines)), sym);
    case "counter:monthRevenue": return money(since(startOfMonth, saleTotal), sym);
    case "counter:customers": return String(data.customers.length);
    case "counter:suppliers": return String(data.suppliers.length);
    case "counter:bills": return String(data.sales.length);
    case "counter:purchases": return String(data.purchases.length);
    case "counter:categories": return String(data.categories.length);
    default: return "—";
  }
}

const MENU_W = 224;

export function ItemMenuHost() {
  const [target, setTarget] = useState<MenuTarget | null>(null);
  const [at, setAt] = useState<Point>({ x: 0, y: 0 });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const settings = useProjectStore((s) => s.data?.settings);
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    openFn = (t, p) => {
      setTarget(t);
      setAt(p);
      setRenaming(false);
      setName(settingsRef.current?.tabRenames?.[t.id] ?? "");
    };
    return () => { openFn = null; };
  }, []);

  useEffect(() => {
    if (!target) return;
    const close = () => setTarget(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [target]);

  if (!target || !settings) return null;
  const pinned = isPinned(settings, target.id);

  const left = Math.min(at.x, Math.max(8, window.innerWidth - MENU_W - 8));
  const top = Math.min(at.y, Math.max(8, window.innerHeight - 160));

  function doRename() {
    renameTab(target!.id, name);
    toast.success("Renamed");
    setTarget(null);
  }

  return (
    <div className="fixed inset-0 z-[100]" onMouseDown={() => setTarget(null)} onContextMenu={(e) => { e.preventDefault(); setTarget(null); }}>
      <div
        role="menu"
        style={{ left, top, width: MENU_W }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute rounded-md border bg-popover p-1 text-popover-foreground shadow-elevated"
      >
        <div className="truncate px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          {target.label}
        </div>
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
          onClick={() => {
            const nowPinned = togglePin(target);
            toast.success(nowPinned ? "Pinned to bottom panel" : "Unpinned");
            setTarget(null);
          }}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {pinned ? "Unpin" : "Pin to bottom panel"}
        </button>

        {target.canRename && isAdmin && !renaming && (
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => setRenaming(true)}
          >
            <Pencil className="h-4 w-4" /> Rename
          </button>
        )}

        {renaming && (
          <div className="border-t p-2">
            <Input
              value={name}
              autoFocus
              placeholder={target.label}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doRename(); }}
              className="h-8 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-7 flex-1 text-xs" onClick={doRename}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRenaming(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Blank restores the original name.</p>
          </div>
        )}

        {target.canRename && !isAdmin && (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">Renaming is admin-only.</p>
        )}
      </div>
    </div>
  );
}
