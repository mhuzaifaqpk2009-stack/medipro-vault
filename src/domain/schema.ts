/**
 * Canonical in-memory project schema. Every module operates on this shape;
 * services in src/domain/services return derived views.
 */

export interface PharmacySettings {
  pharmacyName: string; ownerName: string; phone: string; email: string; address: string;
  taxPercent: number; maxDiscount?: number; singleSessionOnly?: boolean;
  defaultSearchBy?: "name" | "generic" | "company"; notifyOnDeleteMedicine?: boolean;
  notifyOnAddMedicine?: boolean; notifyOnAddCustomer?: boolean; notifyOnLargeSale?: boolean;
  notifyOnForceSale?: boolean; largeSaleThreshold?: number; invoiceCounter?: number; currency: string; currencySymbol: string;
  receiptFooter: string; receiptLogoDataUrl?: string; billFooter1: string; billFooter2: string;
  autoSaveEnabled: boolean; autoSaveIntervalMinutes: 1 | 2 | 5 | 10 | 15;
  theme: "light" | "dark"; passwordProtected: boolean; tabShortcutsEnabled?: boolean;
  tabShortcuts?: Record<string, number>; tabHotkeys?: Record<string, string>;
  actionHotkeys?: Record<string, string>; tabOrder?: string[]; tabGroups?: Record<string, string>;
  tabRenames?: Record<string, string>; groupRenames?: Record<string, string>; calculatorEnabled?: boolean;
  dashboardHidden?: string[]; trendMetric?: "sales" | "profit" | "purchases";
  trendRange?: "week" | "month" | "all"; trendChartType?: "bar" | "line";
  hiddenQuickActions?: string[]; pinnedItems?: PinnedItem[]; pinPanelHidden?: boolean;
  pinPanelMinimized?: boolean; sidebarWidth?: number; topbarHeight?: number; pinBarHeight?: number;
  autoBackupEnabled?: boolean; autoBackupIntervalHours?: number; autoBackupFolder?: string;
  lastAutoBackupAt?: number; backupPasswordEnabled?: boolean; backupPassword?: string;
  /** Admin-controlled global switch for checkout price overrides. Defaults to enabled. */
  allowCheckoutPriceChange?: boolean;
}
export type PinKind = "nav" | "action" | "cmd" | "counter";
export interface PinnedItem { id: string; label: string; kind: PinKind; to?: string; }
export interface Category { id: string; name: string; description?: string; }
export interface Supplier { id: string; name: string; phone?: string; email?: string; address?: string; company?: string; balance: number; }
export interface Customer { id: string; name: string; phone?: string; email?: string; address?: string; balance: number; loyaltyPoints: number; specialDiscountPercent?: number; }
export interface Medicine {
  id: string; name: string; genericName?: string; company?: string; categoryId?: string; batchNumber?: string;
  barcode?: string; purchasePrice: number; salePrice: number; mrp: number; stockQuantity: number;
  minimumStock: number; expiryDate?: string; manufactureDate?: string; rackNumber?: string;
  supplierId?: string; description?: string; pinOrder?: "first" | "last";
}
export interface PurchaseItem { medicineId: string; quantity: number; purchasePrice: number; batchNumber?: string; expiryDate?: string; }
export interface Purchase { id: string; supplierId: string; invoiceNumber: string; purchaseDate: string; receivedDate?: string; items: PurchaseItem[]; taxPercent: number; discount: number; notes?: string; }
export type PaymentMethod = "cash" | "card" | "online" | "mixed";
export interface SaleItem { medicineId: string; quantity: number; salePrice: number; discountPercent: number; costPriceAtSale?: number; forcedSale?: boolean; }
export interface SalePayment { method: "cash" | "card" | "online"; amount: number; reference?: string; }
export interface Sale {
  id: string; invoiceNumber: string; date: string; customerId?: string; remark?: string; items: SaleItem[];
  discount: number; taxPercent: number; payments: SalePayment[]; status: "completed" | "cancelled" | "returned";
  notes?: string; createdBy?: string; reprints?: string[];
}
export interface StockAdjustment { id: string; medicineId: string; date: string; delta: number; reason: string; }
export interface ProjectData {
  meta: { id: string; name: string; createdAt: string; updatedAt: string; schemaVersion: number };
  settings: PharmacySettings; categories: Category[]; suppliers: Supplier[]; customers: Customer[];
  medicines: Medicine[]; purchases: Purchase[]; sales: Sale[]; stockAdjustments: StockAdjustment[];
}
export const SCHEMA_VERSION = 1;
export function createEmptyProject(name: string, passwordProtected: boolean): ProjectData {
  const now = new Date().toISOString();
  return {
    meta: { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, schemaVersion: SCHEMA_VERSION },
    settings: {
      pharmacyName: name, ownerName: "", phone: "", email: "", address: "", taxPercent: 0, maxDiscount: 0,
      currency: "USD", currencySymbol: "$", receiptFooter: "Thank you for your purchase",
      billFooter1: "Thanks for purchasing",
      billFooter2: "Please check & verify your medicines. Medicines will be returned within 15 days. Fridge items are not returnable. Pharmacy is not responsible after this period.",
      autoSaveEnabled: true, autoBackupEnabled: false, autoBackupIntervalHours: 24, autoSaveIntervalMinutes: 5,
      theme: "light", passwordProtected, allowCheckoutPriceChange: true,
    },
    categories: [], suppliers: [], customers: [], medicines: [], purchases: [], sales: [], stockAdjustments: [],
  };
}