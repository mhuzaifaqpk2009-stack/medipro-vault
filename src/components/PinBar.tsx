import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Pin, ChevronDown, ChevronUp, Save, HardDriveDownload,
  LayoutDashboard, ShoppingCart, Receipt, Pill, Boxes, Truck, Building2, Users, Tags, BarChart3, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { counterValue, pinContext } from "@/lib/pins";
import { runBackupNow } from "@/lib/backup";
import { ResizeHandle } from "@/components/ResizeHandle";

const ICONS: Record<string, any> = {
  "/app": LayoutDashboard,
  "/app/sales": ShoppingCart,
  "/app/bills": Receipt,
  "/app/medicines": Pill,
  "/app/inventory": Boxes,
  "/app/purchases": Truck,
  "/app/suppliers": Building2,
  "/app/customers": Users,
  "/app/categories": Tags,
  "/app/reports": BarChart3,
  "/app/settings": Settings,
  "cmd:save": Save,
  "cmd:backup": HardDriveDownload,
};

/** Always-visible bottom strip holding pinned buttons, counters and commands. */
export function PinBar() {
  const data = useProjectStore((s) => s.data);
  const mutate = useProjectStore((s) => s.mutate);
  const save = useProjectStore((s) => s.save);
  const user = useSession((s) => s.user);
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const s = data.settings;
  const allowed = user?.role === "admin" || !!user?.permissions.pinPanel;
  if (!allowed || s.pinPanelHidden) return null;

  const items = s.pinnedItems ?? [];
  const minimized = !!s.pinPanelMinimized;
  const height = Math.min(220, Math.max(44, s.pinBarHeight ?? 60));

  function setMinimized(v: boolean) {
    mutate((d) => { d.settings.pinPanelMinimized = v; });
  }

  async function runCmd(id: string) {
    setBusy(true);
    try {
      if (id === "cmd:save") {
        const ok = await save();
        toast[ok ? "success" : "error"](ok ? "Saved" : "Save failed");
      } else if (id === "cmd:backup") {
        const written = await runBackupNow();
        if (written) toast.success(`Backup saved: ${written}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur">
      {!minimized && (
        <ResizeHandle
          orientation="horizontal"
          value={height}
          invert
          min={44}
          max={220}
          onChange={(v) => mutate((d) => { d.settings.pinBarHeight = v; })}
        />
      )}
      <div
        className="flex items-center gap-2 overflow-x-auto px-3"
        style={{ height: minimized ? 32 : height }}
      >
        <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
        {minimized ? (
          <span className="text-xs text-muted-foreground">Pinned panel ({items.length})</span>
        ) : items.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Right-click any tab, counter or button and choose “Pin” to place it here.
          </span>
        ) : (
          items.map((p) => {
            const Icon = ICONS[p.id] ?? ICONS[p.to ?? ""] ?? Pin;
            const menu = pinContext({ ...p });
            if (p.kind === "counter") {
              return (
                <div
                  key={p.id}
                  {...menu}
                  className="flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-display text-sm font-bold tabular-nums">
                    {counterValue(data, p.id)}
                  </span>
                </div>
              );
            }
            if (p.kind === "cmd") {
              return (
                <Button
                  key={p.id}
                  {...menu}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={busy}
                  onClick={() => void runCmd(p.id)}
                >
                  <Icon className="mr-1.5 h-4 w-4" /> {p.label}
                </Button>
              );
            }
            return (
              <Link
                key={p.id}
                to={p.to ?? p.id}
                draggable={false}
                {...menu}
                className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Icon className="h-4 w-4 text-primary" /> {p.label}
              </Link>
            );
          })
        )}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-7 w-7 shrink-0"
          title={minimized ? "Expand pinned panel" : "Minimize pinned panel"}
          onClick={() => setMinimized(!minimized)}
        >
          {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
