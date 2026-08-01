import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  Tags,
  Boxes,
  BarChart3,
  Settings,
  Receipt,
  Pencil,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session-store";
import { useProjectStore } from "@/store/project-store";
import type { UserPermissions } from "@/lib/users";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  exact?: boolean;
  perm?: keyof UserPermissions;
  adminOnly?: boolean;
};

/** Default order — also the order restored by "Reset" in edit mode. */
const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true, adminOnly: true },
  { to: "/app/sales", label: "Sales (POS)", icon: ShoppingCart, perm: "sales" },
  { to: "/app/bills", label: "Bills", icon: Receipt, perm: "bills" },
  { to: "/app/medicines", label: "Medicines", icon: Pill, perm: "medicines" },
  { to: "/app/inventory", label: "Inventory", icon: Boxes, perm: "inventory" },
  { to: "/app/purchases", label: "Purchases", icon: Truck, perm: "purchases" },
  { to: "/app/suppliers", label: "Suppliers", icon: Building2, perm: "suppliers" },
  { to: "/app/customers", label: "Customers", icon: Users, perm: "customers" },
  { to: "/app/categories", label: "Categories", icon: Tags, perm: "categories" },
  { to: "/app/reports", label: "Reports", icon: BarChart3, perm: "reports" },
  { to: "/app/settings", label: "Settings", icon: Settings, adminOnly: true },
];

/** Order NAV by the saved tab order, appending anything new at the end. */
export function orderNav(order?: string[]) {
  if (!order || order.length === 0) return NAV;
  const byPath = new Map(NAV.map((n) => [n.to, n]));
  const out: NavItem[] = [];
  for (const to of order) {
    const item = byPath.get(to);
    if (item) { out.push(item); byPath.delete(to); }
  }
  for (const item of NAV) if (byPath.has(item.to)) out.push(item);
  return out;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const tabOrder = useProjectStore((s) => s.data?.settings.tabOrder);
  const mutate = useProjectStore((s) => s.mutate);
  const [editing, setEditing] = useState(false);

  const items = useMemo(() => {
    const ordered = orderNav(tabOrder);
    return ordered.filter((i) => {
      if (i.adminOnly) return isAdmin;
      if (i.perm) return isAdmin || !!user?.permissions[i.perm];
      return true;
    });
  }, [tabOrder, isAdmin, user]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Merge the visible order back into the full order so hidden tabs survive.
    const visiblePaths = new Set(items.map((i) => i.to));
    const full = orderNav(tabOrder).map((i) => i.to);
    let vi = 0;
    const merged = full.map((p) => (visiblePaths.has(p) ? next[vi++].to : p));
    mutate((d) => { d.settings.tabOrder = merged; });
  }

  function resetOrder() {
    mutate((d) => { d.settings.tabOrder = []; });
  }

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-white shadow-soft">
            <img src="./logo.png" alt="Huzaifa Software" className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-display text-sm font-semibold">Huzaifa Software</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {user ? `${user.username} · ${user.role}` : "Pharmacy Suite"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <div className="flex items-center justify-between pr-1">
              <SidebarGroupLabel>{editing ? "Reorder tabs" : "Navigation"}</SidebarGroupLabel>
              <div className="flex items-center gap-1">
                {editing && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" title="Reset to default order" onClick={resetOrder}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  title={editing ? "Done" : "Edit tab order"}
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((i, index) => {
                const active = isActive(i.to, i.exact);
                const Icon = i.icon;
                if (editing && !collapsed) {
                  return (
                    <SidebarMenuItem key={i.to}>
                      <div className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{i.label}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={() => move(index, -1)}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  );
                }
                return (
                  <SidebarMenuItem key={i.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={i.label}>
                      <Link
                        to={i.to}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md",
                          active && "bg-sidebar-accent text-sidebar-accent-foreground",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                        )}
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span className="truncate">{i.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
