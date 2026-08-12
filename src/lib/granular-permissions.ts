/** Action-level permission checks used by both Single and Multi computer modes. */
import type { StoredUser } from "./users";

export type CrudEntity = "medicines" | "customers" | "purchases" | "suppliers" | "categories";
export type CrudAction = "Add" | "Edit" | "Delete";

function allowed(u: StoredUser | null, key: string, page: keyof StoredUser["permissions"]): boolean {
  if (!u || u.role === "admin") return true;
  if (!u.permissions[page]) return false;
  return u.permissions[key as keyof StoredUser["permissions"]] === true;
}
export function canAddMedicine(u: StoredUser | null) { return allowed(u, "medicinesAdd", "medicines"); }
export function canEditMedicine(u: StoredUser | null) { return allowed(u, "medicinesEdit", "medicines"); }
export function canDeleteMedicine(u: StoredUser | null) { return allowed(u, "medicinesDelete", "medicines"); }
export function canAddCustomer(u: StoredUser | null) { return allowed(u, "customersAdd", "customers"); }
export function canEditCustomer(u: StoredUser | null) { return allowed(u, "customersEdit", "customers"); }
export function canDeleteCustomer(u: StoredUser | null) { return allowed(u, "customersDelete", "customers"); }
export function canAddPurchase(u: StoredUser | null) { return allowed(u, "purchasesAdd", "purchases"); }
export function canEditPurchase(u: StoredUser | null) { return allowed(u, "purchasesEdit", "purchases"); }
export function canDeletePurchase(u: StoredUser | null) { return allowed(u, "purchasesDelete", "purchases"); }
export function canAddSupplier(u: StoredUser | null) { return allowed(u, "suppliersAdd", "suppliers"); }
export function canEditSupplier(u: StoredUser | null) { return allowed(u, "suppliersEdit", "suppliers"); }
export function canDeleteSupplier(u: StoredUser | null) { return allowed(u, "suppliersDelete", "suppliers"); }
export function canAddCategory(u: StoredUser | null) { return allowed(u, "categoriesAdd", "categories"); }
export function canEditCategory(u: StoredUser | null) { return allowed(u, "categoriesEdit", "categories"); }
export function canDeleteCategory(u: StoredUser | null) { return allowed(u, "categoriesDelete", "categories"); }
export function canExportReports(u: StoredUser | null) { return !u || u.role === "admin" || (u.permissions.reports && u.permissions.reportsExport === true); }
export function canPrintReports(u: StoredUser | null) { return !u || u.role === "admin" || (u.permissions.reports && u.permissions.reportsPrint === true); }
export function canApplyDiscount(u: StoredUser | null) { return !u || u.role === "admin" || u.permissions.applyDiscount === true; }
export function canForceSale(u: StoredUser | null) { return !u || u.role === "admin" || u.permissions.forceSale === true; }
export function canChangeCheckoutPrice(u: StoredUser | null) { return !u || u.role === "admin" || u.permissions.changeCheckoutPrice === true; }