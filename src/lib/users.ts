/**
 * Multi-user accounts + permissions.
 * Stored inside the localStorage install record (local desktop app).
 * The admin (first user) also holds the file-encryption password.
 */

export type UserRole = "admin" | "user";

export interface UserPermissions {
  sales: boolean;
  bills: boolean;
  medicines: boolean;
  inventory: boolean;
  purchases: boolean;
  reports: boolean;
  suppliers: boolean;
  categories: boolean;
  customers: boolean;
  applyDiscount: boolean;
  changeTax: boolean;
  forceSale: boolean;
  /** See and use the bottom pinned panel. */
  pinPanel?: boolean;
}


export type CounterId =
  | "totalMedicines"
  | "lowStock"
  | "expired"
  | "todayRevenue"
  | "todayProfit"
  | "monthRevenue"
  | "customers"
  | "suppliers"
  | "salesTrend"
  | "mostSold";

export const ALL_COUNTERS: { id: CounterId; label: string }[] = [
  { id: "totalMedicines", label: "Total Medicines" },
  { id: "lowStock", label: "Low Stock" },
  { id: "expired", label: "Expired" },
  { id: "todayRevenue", label: "Today's Sales" },
  { id: "todayProfit", label: "Today's Profit" },
  { id: "monthRevenue", label: "Monthly Sales" },
  { id: "customers", label: "Customers" },
  { id: "suppliers", label: "Suppliers" },
  { id: "salesTrend", label: "Sales trend chart" },
  { id: "mostSold", label: "Most sold panel" },
];

/**
 * Role templates offered when creating a user in Multi computer mode only.
 * Single computer mode keeps the plain Admin/User(limited) picker untouched —
 * these templates just pre-fill the same UserPermissions object that already
 * drives PermissionGate everywhere else, so nothing downstream needs to change.
 */
export type RoleTemplate = "seller" | "custom" | "manager";

export const ROLE_TEMPLATE_LABELS: Record<RoleTemplate, string> = {
  seller: "Seller — Sales (POS) + Bills only",
  custom: "Custom — pick exact permissions",
  manager: "Manager — every panel except Settings",
};

export interface StoredUser {
  id: string;
  username: string;
  role: UserRole;
  saltHex: string;
  hashHex: string;
  permissions: UserPermissions;
  /** Which dashboard counters are visible to this user. Omitted = all visible. */
  dashboardVisibility?: Partial<Record<CounterId, boolean>>;
  /** Per-user override for maximum discount amount. 0/undefined = fall back to settings. */
  maxDiscount?: number;
  /**
   * Which role template this user was created/last edited as, in Multi computer
   * mode. Cosmetic only — re-selects the right option when editing. The
   * `permissions` object above is still the only thing PermissionGate reads.
   */
  roleTemplate?: RoleTemplate;
}

/**
 * Permission preset for a Multi-computer role template. "custom" starts from
 * the same blank slate as today's User(limited) so the admin picks manually.
 */
export function permissionsForTemplate(template: RoleTemplate): UserPermissions {
  if (template === "manager") {
    return {
      sales: true, bills: true, medicines: true, inventory: true,
      purchases: true, reports: true, suppliers: true, categories: true,
      customers: true, applyDiscount: true, changeTax: true, forceSale: true,
      pinPanel: true,
    };
  }
  if (template === "seller") {
    return {
      sales: true, bills: true, medicines: false, inventory: false,
      purchases: false, reports: false, suppliers: false, categories: false,
      customers: false, applyDiscount: false, changeTax: false, forceSale: false,
      pinPanel: false,
    };
  }
  return defaultPermissions("user");
}

export function defaultPermissions(role: UserRole): UserPermissions {
  if (role === "admin") {
    return {
      sales: true, bills: true, medicines: true, inventory: true,
      purchases: true, reports: true, suppliers: true, categories: true,
      customers: true, applyDiscount: true, changeTax: true, forceSale: true,
      pinPanel: true,
    };
  }
  return {
    sales: true, bills: true, medicines: false, inventory: false,
    purchases: false, reports: false, suppliers: false, categories: false,
    customers: false, applyDiscount: false, changeTax: false, forceSale: false,
    pinPanel: false,
  };
}


export function isCounterVisible(u: StoredUser | null, id: CounterId): boolean {
  if (!u) return true;
  if (u.role === "admin") return true;
  const v = u.dashboardVisibility?.[id];
  return v !== false; // default: visible
}
