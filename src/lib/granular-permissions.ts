/**
 * Granular action-level permission checks (items 4 & 5): whether a user can
 * add/edit/delete a medicine, add a customer, or add a category.
 *
 * Single computer mode is completely unaffected by these — it only ever
 * checks the plain `medicines`/`customers`/`categories` page-access flags,
 * exactly as it always has. The granular sub-permissions only take effect
 * in Multi computer mode, where "page access" and "what you can do on that
 * page" are separate, admin-configurable things (Seller/Custom templates).
 */
import { isMultiMode } from "./install";
import type { StoredUser } from "./users";

function pageAccess(u: StoredUser | null, page: "medicines" | "customers" | "categories"): boolean {
  if (!u) return true; // no session context (e.g. very early boot) — don't block
  if (u.role === "admin") return true;
  return !!u.permissions[page];
}

export function canAddMedicine(u: StoredUser | null): boolean {
  if (!pageAccess(u, "medicines")) return false;
  if (!u || u.role === "admin") return true;
  if (!isMultiMode()) return true; // single mode: page access alone has always meant full CRUD
  return !!u.permissions.medicinesAdd;
}

export function canEditMedicine(u: StoredUser | null): boolean {
  if (!pageAccess(u, "medicines")) return false;
  if (!u || u.role === "admin") return true;
  if (!isMultiMode()) return true;
  return !!u.permissions.medicinesEdit;
}

export function canDeleteMedicine(u: StoredUser | null): boolean {
  if (!pageAccess(u, "medicines")) return false;
  if (!u || u.role === "admin") return true;
  if (!isMultiMode()) return true;
  return !!u.permissions.medicinesDelete;
}

export function canAddCustomer(u: StoredUser | null): boolean {
  if (!pageAccess(u, "customers")) return false;
  if (!u || u.role === "admin") return true;
  if (!isMultiMode()) return true;
  return !!u.permissions.customersAdd;
}

export function canAddCategory(u: StoredUser | null): boolean {
  if (!pageAccess(u, "categories")) return false;
  if (!u || u.role === "admin") return true;
  if (!isMultiMode()) return true;
  return !!u.permissions.categoriesAdd;
}
