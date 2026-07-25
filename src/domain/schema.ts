/**
 * Canonical in-memory project schema. Every module operates on this shape;
 * services in src/domain/services return derived views.
 */

export interface PharmacySettings {
  pharmacyName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  taxPercent: number;
  /** Cap on flat discount amount for non-admin users at checkout. 0/undefined = unlimited. */
  maxDiscount?: number;
  currency: string;
  currencySymbol: string;
  receiptFooter: string;
  receiptLogoDataUrl?: string;
  billFooter1: string;
  billFooter2: string;
  autoSaveEnabled: boolean;
  autoSaveIntervalMinutes: 1 | 2 | 5 | 10 | 15;
  theme: "light" | "dark";
  passwordProtected: boolean;
  /** Enable Ctrl+1..9 / Ctrl+Tab / Ctrl+Shift+Tab shortcuts for switching workspace tabs. */
  tabShortcutsEnabled?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  company?: string;
  balance: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  loyaltyPoints: number;
}

export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  company?: string;
  categoryId?: string;
  batchNumber?: string;
  barcode?: string;
  purchasePrice: number;
  salePrice: number;
  mrp: number;
  stockQuantity: number;
  minimumStock: number;
  expiryDate?: string;
  manufactureDate?: string;
  rackNumber?: string;
  supplierId?: string;
  description?: string;
}

export interface PurchaseItem {
  medicineId: string;
  quantity: number;
  purchasePrice: number;
  batchNumber?: string;
  expiryDate?: string;
}
export interface Purchase {
  id: string;
  supplierId: string;
  invoiceNumber: string;
  purchaseDate: string;
  receivedDate?: string;
  items: PurchaseItem[];
  taxPercent: number;
  discount: number;
  notes?: string;
}

export type PaymentMethod = "cash" | "card" | "online" | "mixed";
export interface SaleItem {
  medicineId: string;
  quantity: number;
  salePrice: number;
  discountPercent: number;
}
export interface SalePayment {
  method: "cash" | "card" | "online";
  amount: number;
  reference?: string;
}
export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId?: string;
  /** Cashier-entered free-text note printed on the receipt. */
  remark?: string;
  items: SaleItem[];
  discount: number;
  taxPercent: number;
  payments: SalePayment[];
  status: "completed" | "cancelled" | "returned";
  notes?: string;
  /** Username of the cashier who created the sale (for audit). */
  createdBy?: string;
}

export interface StockAdjustment {
  id: string;
  medicineId: string;
  date: string;
  delta: number;
  reason: string;
}

export interface ProjectData {
  meta: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    schemaVersion: number;
  };
  settings: PharmacySettings;
  categories: Category[];
  suppliers: Supplier[];
  customers: Customer[];
  medicines: Medicine[];
  purchases: Purchase[];
  sales: Sale[];
  stockAdjustments: StockAdjustment[];
}

export const SCHEMA_VERSION = 1;

export function createEmptyProject(name: string, passwordProtected: boolean): ProjectData {
  const now = new Date().toISOString();
  return {
    meta: {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    },
    settings: {
      pharmacyName: name,
      ownerName: "",
      phone: "",
      email: "",
      address: "",
      taxPercent: 0,
      maxDiscount: 0,
      currency: "USD",
      currencySymbol: "$",
      receiptFooter: "Thank you for your purchase",
      billFooter1: "Thanks for purchasing",
      billFooter2: "Please check & verify your medicines. Medicines will be returned within 15 days. Fridge items are not returnable. Pharmacy is not responsible after this period.",
      autoSaveEnabled: true,
      autoSaveIntervalMinutes: 5,
      theme: "light",
      passwordProtected,
    },
    categories: [],
    suppliers: [],
    customers: [],
    medicines: [],
    purchases: [],
    sales: [],
    stockAdjustments: [],
  };
}
