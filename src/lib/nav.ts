/** Single source of truth for workspace navigation. */
import { LayoutDashboard, Pill, ShoppingCart, Truck, Users, Building2, Tags, Boxes, BarChart3, Settings, Receipt, Calculator, Keyboard, Barcode, FileText } from "lucide-react";
import type { UserPermissions, StoredUser } from "@/lib/users";
import type { PharmacySettings } from "@/domain/schema";
export type NavItem = { to: string; label: string; icon: any; exact?: boolean; perm?: keyof UserPermissions; adminOnly?: boolean; group: string };
export const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true, adminOnly: true, group: "Main" },
  { to: "/app/sales", label: "Sales (POS)", icon: ShoppingCart, perm: "sales", group: "Main" },
  { to: "/app/bills", label: "Bills", icon: Receipt, perm: "bills", group: "Main" },
  { to: "/app/medicines", label: "Medicines", icon: Pill, perm: "medicines", group: "Inventory" },
  { to: "/app/inventory", label: "Inventory", icon: Boxes, perm: "inventory", group: "Inventory" },
  { to: "/app/purchases", label: "Purchases", icon: Truck, perm: "purchases", group: "Inventory" },
  { to: "/app/categories", label: "Categories", icon: Tags, perm: "categories", group: "Inventory" },
  { to: "/app/operations", label: "Pharmacy Operations", icon: Barcode, perm: "operations", group: "Inventory" },
  { to: "/app/prescriptions", label: "Prescriptions", icon: FileText, perm: "sales", group: "People" },
  { to: "/app/suppliers", label: "Suppliers", icon: Building2, perm: "suppliers", group: "People" },
  { to: "/app/customers", label: "Customers", icon: Users, perm: "customers", group: "People" },
  { to: "/app/calculator", label: "Calculator", icon: Calculator, group: "Insights" },
  { to: "/app/shortcuts", label: "Shortcuts", icon: Keyboard, group: "Insights" },
  { to: "/app/reports", label: "Reports", icon: BarChart3, perm: "reports", group: "Insights" },
  { to: "/app/settings", label: "Settings", icon: Settings, adminOnly: true, group: "Insights" },
];
export const GROUPS = ["Main", "Inventory", "People", "Insights"];
export function orderNav(order?: string[]): NavItem[] { if (!order || order.length === 0) return NAV; const byPath = new Map(NAV.map((n) => [n.to, n])); const out: NavItem[] = []; for (const to of order) { const item = byPath.get(to); if (item) { out.push(item); byPath.delete(to); } } for (const item of NAV) if (byPath.has(item.to)) out.push(item); return out; }
export function groupLabel(group: string, settings?: PharmacySettings) { return settings?.groupRenames?.[group] || group; }
export function navLabel(item: NavItem, settings?: PharmacySettings) { return settings?.tabRenames?.[item.to] || item.label; }
export function visibleNavItems(settings?: PharmacySettings, user?: StoredUser | null): NavItem[] { const isAdmin = user?.role === "admin"; const groupOf = (i: NavItem) => settings?.tabGroups?.[i.to] || i.group; const allowed = orderNav(settings?.tabOrder).filter((i) => { if (i.to === "/app/calculator" && settings?.calculatorEnabled === false) return false; if (i.adminOnly) return isAdmin; if (i.perm) return isAdmin || !!user?.permissions[i.perm]; return true; }); return GROUPS.flatMap((g) => allowed.filter((i) => groupOf(i) === g)); }
