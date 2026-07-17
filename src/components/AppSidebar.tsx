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
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const primary = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/sales", label: "Sales (POS)", icon: ShoppingCart },
  { to: "/app/medicines", label: "Medicines", icon: Pill },
  { to: "/app/inventory", label: "Inventory", icon: Boxes },
] as const;

const secondary = [
  { to: "/app/purchases", label: "Purchases", icon: Truck },
  { to: "/app/suppliers", label: "Suppliers", icon: Building2 },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/categories", label: "Categories", icon: Tags },
] as const;

const bottom = [
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const Section = ({
    label,
    items,
  }: {
    label: string;
    items: ReadonlyArray<{ to: string; label: string; icon: any; exact?: boolean }>;
  }) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((i) => {
            const active = isActive(i.to, i.exact);
            const Icon = i.icon;
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
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft">
            <Stethoscope className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold">MediCore</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Pharmacy Suite
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Section label="Operate" items={primary} />
        <Section label="Records" items={secondary} />
        <Section label="System" items={bottom} />
      </SidebarContent>
    </Sidebar>
  );
}
