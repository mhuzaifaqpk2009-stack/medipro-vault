/**
 * Multi-user accounts + permissions.
 * Stored inside the localStorage install record (local desktop app).
 * The admin (first user) also holds the file-encryption password.
 */

export type UserRole = "admin" | "user";

export interface UserPermissions {
  medicines: boolean;
  inventory: boolean;
  purchases: boolean;
  reports: boolean;
  suppliers: boolean;
  categories: boolean;
  applyDiscount: boolean;
  changeTax: boolean;
  forceSale: boolean;
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

export interface StoredUser {
  id: string;
  username: string;
  role: UserRole;
  saltHex: string;
  hashHex: string;
  permissions: UserPermissions;
  /** Which dashboard counters are visible to this user. Omitted = all visible. */
  dashboardVisibility?: Partial<Record<CounterId, boolean>>;
}

export function defaultPermissions(role: UserRole): UserPermissions {
  if (role === "admin") {
    return {
      medicines: true, inventory: true, purchases: true, reports: true,
      suppliers: true, categories: true,
      applyDiscount: true, changeTax: true, forceSale: true,
    };
  }
  return {
    medicines: false, inventory: false, purchases: false, reports: false,
    suppliers: false, categories: false,
    applyDiscount: false, changeTax: false, forceSale: false,
  };
}

export function isCounterVisible(u: StoredUser | null, id: CounterId): boolean {
  if (!u) return true;
  if (u.role === "admin") return true;
  const v = u.dashboardVisibility?.[id];
  return v !== false; // default: visible
}
