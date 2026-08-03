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
  GripVertical,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session-store";
import { useProjectStore } from "@/store/project-store";
import type { UserPermissions } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { pinContext } from "@/lib/pins";
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
  group: string;
};

/** Default order & grouping — also what "Reset" restores in edit mode. */
const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true, adminOnly: true, group: "Main" },
  { to: "/app/sales", label: "Sales (POS)", icon: ShoppingCart, perm: "sales", group: "Main" },
  { to: "/app/bills", label: "Bills", icon: Receipt, perm: "bills", group: "Main" },
  { to: "/app/medicines", label: "Medicines", icon: Pill, perm: "medicines", group: "Inventory" },
  { to: "/app/inventory", label: "Inventory", icon: Boxes, perm: "inventory", group: "Inventory" },
  { to: "/app/purchases", label: "Purchases", icon: Truck, perm: "purchases", group: "Inventory" },
  { to: "/app/categories", label: "Categories", icon: Tags, perm: "categories", group: "Inventory" },
  { to: "/app/suppliers", label: "Suppliers", icon: Building2, perm: "suppliers", group: "People" },
  { to: "/app/customers", label: "Customers", icon: Users, perm: "customers", group: "People" },
  { to: "/app/reports", label: "Reports", icon: BarChart3, perm: "reports", group: "Insights" },
  { to: "/app/settings", label: "Settings", icon: Settings, adminOnly: true, group: "Insights" },
];

const GROUPS = ["Main", "Inventory", "People", "Insights"];

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
  const renames = useProjectStore((s) => s.data?.settings.tabRenames);
  const groupOverrides = useProjectStore((s) => s.data?.settings.tabGroups);
  const mutate = useProjectStore((s) => s.mutate);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const groupOf = (item: NavItem) => groupOverrides?.[item.to] || item.group;

  const items = useMemo(() => {
    const ordered = orderNav(tabOrder);
    return ordered.filter((i) => {
      if (i.adminOnly) return isAdmin;
      if (i.perm) return isAdmin || !!user?.permissions[i.perm];
      return true;
    });
  }, [tabOrder, isAdmin, user]);

  const labelOf = (to: string, fallback: string) => renames?.[to] || fallback;

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  /** Move `from` to just before/after `to` in the persisted order (and adopt its group). */
  function reorder(fromPath: string, toPath: string) {
    if (fromPath === toPath) return;
    const full = orderNav(tabOrder).map((i) => i.to);
    const next = full.filter((p) => p !== fromPath);
    const at = next.indexOf(toPath);
    next.splice(at < 0 ? next.length : at, 0, fromPath);
    const targetItem = NAV.find((n) => n.to === toPath);
    const targetGroup = groupOverrides?.[toPath] || targetItem?.group;
    mutate((d) => {
      d.settings.tabOrder = next;
      if (targetGroup) {
        d.settings.tabGroups = { ...(d.settings.tabGroups ?? {}), [fromPath]: targetGroup };
      }
    });
  }

  /** Drop a tab onto a category header to move it into that category. */
  function moveToGroup(fromPath: string, group: string) {
    mutate((d) => {
      d.settings.tabGroups = { ...(d.settings.tabGroups ?? {}), [fromPath]: group };
    });
  }

  function resetOrder() {
    mutate((d) => { d.settings.tabOrder = []; d.settings.tabGroups = {}; });
  }

  const groupsToRender = editing && !collapsed
    ? GROUPS
    : GROUPS.filter((g) => items.some((i) => groupOf(i) === g));

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-white shadow-soft">
            <img src="./logo.png" alt="Huzaifa Software" className="h-8 w-8 object-contain" draggable={false} />
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
        {groupsToRender.map((group, gi) => (
          <SidebarGroup key={group} className={gi === 0 ? "pt-1" : undefined}>
            {!collapsed && (
              <SidebarGroupLabel
                onDragOver={(e) => { if (editing) e.preventDefault(); }}
                onDrop={() => { if (editing && dragging) moveToGroup(dragging, group); setDragging(null); }}
                className={cn("flex items-center", editing && "rounded outline-dashed outline-1 outline-border")}
              >
                <span className="flex-1 truncate">{group}</span>
                {/* Edit controls live on the first category row so nothing sits above it. */}
                {gi === 0 && isAdmin && (
                  <span className="flex items-center gap-0.5">
                    {editing && (
                      <Button size="icon" variant="ghost" className="h-5 w-5" title="Reset to default layout" onClick={resetOrder}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      title={editing ? "Done" : "Edit tab layout"}
                      onClick={() => setEditing((v) => !v)}
                    >
                      {editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                    </Button>
                  </span>
                )}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.filter((i) => groupOf(i) === group).map((i) => {
                  const active = isActive(i.to, i.exact);
                  const Icon = i.icon;
                  const label = labelOf(i.to, i.label);
                  const menu = pinContext({ id: i.to, label, kind: "nav", to: i.to, canRename: true });

                  if (editing && !collapsed) {
                    return (
                      <SidebarMenuItem key={i.to}>
                        <div
                          draggable
                          onDragStart={() => setDragging(i.to)}
                          onDragEnd={() => setDragging(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => { if (dragging) reorder(dragging, i.to); setDragging(null); }}
                          className={cn(
                            "flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm active:cursor-grabbing",
                            dragging === i.to ? "opacity-40" : "hover:bg-sidebar-accent",
                          )}
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{label}</span>
                        </div>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={i.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={label}>
                        <Link
                          to={i.to}
                          draggable={false}
                          {...menu}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-md",
                            active && "bg-sidebar-accent text-sidebar-accent-foreground",
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                          )}
                          <Icon className="h-4 w-4" />
                          {!collapsed && <span className="truncate">{label}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {editing && !collapsed && items.filter((i) => groupOf(i) === group).length === 0 && (
                  <p className="px-2 py-1 text-[11px] text-muted-foreground">Drop a tab here</p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
