import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { useAutoSave } from "@/hooks/use-autosave";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import type { UserPermissions } from "@/lib/users";

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

  const visibleTabs = useMemo(() => {
    const isAdmin = user?.role === "admin";
    return TABS.filter((t) => {
      if (t.adminOnly) return isAdmin;
      if (t.perm) return isAdmin || !!user?.permissions[t.perm];
      return true;
    });
  }, [user]);

  // combo string (normalised) -> tab path
  const hotkeyMap = useMemo(
    () => buildHotkeyMap(visibleTabs, data?.settings.tabHotkeys),
    [visibleTabs, data?.settings.tabHotkeys],
  );

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
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
      // Works from anywhere: close any open panel/dialog first, then navigate.
      forceCloseOverlays();
      navigate({ to });
    };
    // Capture phase so open dialogs/inputs cannot swallow the shortcut.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, visibleTabs, hotkeyMap, navigate, pathname]);


  if (!data) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
