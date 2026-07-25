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

type TabDef = { to: string; perm?: keyof UserPermissions; adminOnly?: boolean };

// Order matches the visual sidebar order.
const TABS: TabDef[] = [
  { to: "/app", adminOnly: true },
  { to: "/app/sales", perm: "sales" },
  { to: "/app/bills", perm: "bills" },
  { to: "/app/medicines", perm: "medicines" },
  { to: "/app/inventory", perm: "inventory" },
  { to: "/app/purchases", perm: "purchases" },
  { to: "/app/suppliers", perm: "suppliers" },
  { to: "/app/customers", perm: "customers" },
  { to: "/app/categories", perm: "categories" },
  { to: "/app/reports", perm: "reports" },
  { to: "/app/settings", adminOnly: true },
];

function AppLayout() {
  useAutoSave();
  const data = useProjectStore((s) => s.data);
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const enabled = data?.settings.tabShortcutsEnabled !== false;

  const visibleTabs = useMemo(() => {
    const isAdmin = user?.role === "admin";
    return TABS.filter((t) => {
      if (t.adminOnly) return isAdmin;
      if (t.perm) return isAdmin || !!user?.permissions[t.perm];
      return true;
    });
  }, [user]);

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

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle
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

      // Ctrl+1..9 — jump to Nth visible tab. Skip when typing.
      if (isEditable(e.target)) return;
      if (e.shiftKey) return;
      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < visibleTabs.length) {
          e.preventDefault();
          navigate({ to: visibleTabs[idx].to });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, visibleTabs, navigate, pathname]);

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
