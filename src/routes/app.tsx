import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { runBackupNow } from "@/lib/backup";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { PinBar } from "@/components/PinBar";
import { ResizeHandle } from "@/components/ResizeHandle";
import { ItemMenuHost } from "@/lib/pins";
import { useAutoSave } from "@/hooks/use-autosave";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import type { UserPermissions } from "@/lib/users";
import {
  comboFromEvent, normaliseCombo, forceCloseOverlays, defaultHotkeyFor,
} from "@/lib/hotkeys";


/** Resolve the effective combo -> path map for the given tabs. */
export function buildHotkeyMap(
  tabs: { to: string }[],
  custom?: Record<string, string>,
) {
  const map = new Map<string, string>();
  tabs.forEach((t, i) => {
    const combo = custom?.[t.to] || defaultHotkeyFor(i);
    if (!combo) return;
    const key = normaliseCombo(combo);
    if (!map.has(key)) map.set(key, t.to);
  });
  return map;
}

/** Effective (possibly custom) combo label for a tab at a given index. */
export function effectiveHotkey(to: string, index: number, custom?: Record<string, string>) {
  return custom?.[to] || defaultHotkeyFor(index);
}


export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "MediCore Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (!useSession.getState().user) throw redirect({ to: "/" });
      if (!useProjectStore.getState().data) throw redirect({ to: "/" });
    }
  },
  component: AppLayout,
});

type TabDef = { to: string; label: string; perm?: keyof UserPermissions; adminOnly?: boolean };

// Order matches the visual sidebar order.
export const TABS: TabDef[] = [
  { to: "/app", label: "Dashboard", adminOnly: true },
  { to: "/app/sales", label: "Sales (POS)", perm: "sales" },
  { to: "/app/bills", label: "Bills", perm: "bills" },
  { to: "/app/medicines", label: "Medicines", perm: "medicines" },
  { to: "/app/inventory", label: "Inventory", perm: "inventory" },
  { to: "/app/purchases", label: "Purchases", perm: "purchases" },
  { to: "/app/suppliers", label: "Suppliers", perm: "suppliers" },
  { to: "/app/customers", label: "Customers", perm: "customers" },
  { to: "/app/categories", label: "Categories", perm: "categories" },
  { to: "/app/reports", label: "Reports", perm: "reports" },
  { to: "/app/settings", label: "Settings", adminOnly: true },
];

function AppLayout() {
  useAutoSave();
  const data = useProjectStore((s) => s.data);
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const enabled = data?.settings.tabShortcutsEnabled !== false;
  const customShortcuts = data?.settings.tabShortcuts;

  const tabOrder = data?.settings.tabOrder;

  const visibleTabs = useMemo(() => {
    const isAdmin = user?.role === "admin";
    const shown = TABS.filter((t) => {
      if (t.adminOnly) return isAdmin;
      if (t.perm) return isAdmin || !!user?.permissions[t.perm];
      return true;
    });
    if (!tabOrder || tabOrder.length === 0) return shown;
    const rank = new Map(tabOrder.map((p, i) => [p, i]));
    return [...shown].sort(
      (a, b) => (rank.get(a.to) ?? 999) - (rank.get(b.to) ?? 999),
    );
  }, [user, tabOrder]);


  // combo string (normalised) -> tab path
  const hotkeyMap = useMemo(
    () => buildHotkeyMap(visibleTabs, data?.settings.tabHotkeys),
    [visibleTabs, data?.settings.tabHotkeys],
  );

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Any open dialog/panel takes precedence — never switch tabs from inside one.
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle from current tab.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "Tab") {
        if (visibleTabs.length === 0) return;
        e.preventDefault();
        const currentIdx = visibleTabs.findIndex(
          (t) => pathname === t.to || pathname.startsWith(t.to + "/"),
        );
        const base = currentIdx < 0 ? 0 : currentIdx;
        const nextIdx = e.shiftKey
          ? (base - 1 + visibleTabs.length) % visibleTabs.length
          : (base + 1) % visibleTabs.length;
        forceCloseOverlays();
        navigate({ to: visibleTabs[nextIdx].to });
        return;
      }

      const combo = comboFromEvent(e);
      if (!combo) return;
      const to = hotkeyMap.get(normaliseCombo(combo));
      if (!to) return;
      e.preventDefault();
      e.stopPropagation();
      forceCloseOverlays();
      navigate({ to });
    };
    // Capture phase so open dialogs/inputs cannot swallow the shortcut.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, visibleTabs, hotkeyMap, navigate, pathname]);

  // "/" — jump into the current page's search box. Ctrl+/ — top panel search.
  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" && e.code !== "Slash") return;
      if (e.altKey) return;
      const global = e.ctrlKey || e.metaKey;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (!global && (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable)) return;
      const search = global
        ? document.querySelector<HTMLInputElement>("[data-global-search]")
        : document.querySelector<HTMLInputElement>("[data-search]");
      if (!search) return;
      e.preventDefault();
      search.focus();
      search.select();
    };
    window.addEventListener("keydown", onSlash, true);
    return () => window.removeEventListener("keydown", onSlash, true);
  }, [pathname]);



  // F5 — create/overwrite a backup in the saved folder.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "F5") return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const written = await runBackupNow();
        if (written) toast.success(`Backup saved: ${written}`);
      } catch (err: any) {
        toast.error(err?.message ?? "Backup failed");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const mutate = useProjectStore((s) => s.mutate);
  const sidebarWidth = Math.min(420, Math.max(180, data?.settings.sidebarWidth ?? 256));

  if (!data) return null;


  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <ResizeHandle
          orientation="vertical"
          value={sidebarWidth}
          min={180}
          max={420}
          onChange={(v) => mutate((d) => { d.settings.sidebarWidth = v; })}
          className="hidden md:block"
        />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <PinBar />
        </SidebarInset>
      </div>
      <ItemMenuHost />
    </SidebarProvider>
  );
}

