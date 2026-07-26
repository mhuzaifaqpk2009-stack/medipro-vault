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

  // Map digit key ("1".."9") -> tab path.
  const digitMap = useMemo(() => {
    const map = new Map<string, string>();
    // First apply user-defined bindings (only for currently visible tabs).
    if (customShortcuts) {
      for (const t of visibleTabs) {
        const n = customShortcuts[t.to];
        if (n && n >= 1 && n <= 9) {
          const key = String(n);
          if (!map.has(key)) map.set(key, t.to);
        }
      }
    }
    // Fill remaining 1..9 slots with visible tabs in order (skipping already-bound).
    let slot = 1;
    for (const t of visibleTabs) {
      if (customShortcuts && customShortcuts[t.to]) continue;
      while (slot <= 9 && map.has(String(slot))) slot++;
      if (slot > 9) break;
      map.set(String(slot), t.to);
      slot++;
    }
    return map;
  }, [visibleTabs, customShortcuts]);

  useEffect(() => {
    if (!enabled) return;
    const isEditable = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      const tag = n.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || n.isContentEditable;
    };
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.altKey) return;

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle from current tab.
      if (e.key === "Tab") {
        if (visibleTabs.length === 0) return;
        e.preventDefault();
        const currentIdx = visibleTabs.findIndex(
          (t) => pathname === t.to || pathname.startsWith(t.to + "/"),
        );
        const base = currentIdx < 0 ? 0 : currentIdx;
        const nextIdx = e.shiftKey
          ? (base - 1 + visibleTabs.length) % visibleTabs.length
          : (base + 1) % visibleTabs.length;
        navigate({ to: visibleTabs[nextIdx].to });
        return;
      }

      // Ctrl+1..9 — jump to bound tab. Skip when typing.
      if (isEditable(e.target)) return;
      if (e.shiftKey) return;
      if (e.key >= "1" && e.key <= "9") {
        const to = digitMap.get(e.key);
        if (to) {
          e.preventDefault();
          navigate({ to });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, visibleTabs, digitMap, navigate, pathname]);

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
