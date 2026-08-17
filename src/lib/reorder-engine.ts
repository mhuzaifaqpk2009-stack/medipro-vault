import type { ProjectData, Medicine } from "@/domain/schema";

export interface ReorderSuggestion {
  medicineId: string;
  medicineName: string;
  stockQuantity: number;
  minimumStock: number;
  averageDailySales: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedOrderQuantity: number;
  stockDaysRemaining: number | null;
}

export interface DeadStockItem {
  medicineId: string;
  medicineName: string;
  stockQuantity: number;
  purchaseValue: number;
  retailValue: number;
  lastSaleDate?: string;
  daysSinceLastSale: number | null;
}

function dayMs() { return 24 * 60 * 60 * 1000; }

function positiveNumber(n: unknown, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/** Sales velocity for the requested medicine over the trailing window. */
export function averageDailySales(data: ProjectData, medicineId: string, windowDays = 30) {
  const end = Date.now();
  const start = end - windowDays * dayMs();
  let quantity = 0;
  for (const sale of data.sales) {
    if (sale.status !== "completed") continue;
    const t = Date.parse(sale.date);
    if (!Number.isFinite(t) || t < start || t > end) continue;
    for (const item of sale.items) {
      if (item.medicineId === medicineId) quantity += positiveNumber(item.quantity);
    }
  }
  return quantity / Math.max(1, windowDays);
}

export function lastSaleDate(data: ProjectData, medicineId: string) {
  let latest = "";
  for (const sale of data.sales) {
    if (sale.status !== "completed") continue;
    if (!sale.items.some(i => i.medicineId === medicineId)) continue;
    if (!latest || sale.date > latest) latest = sale.date;
  }
  return latest || undefined;
}

/**
 * Suggested quantity uses a simple, explainable pharmacy formula:
 * reorder point = average daily sales * lead time + safety stock.
 * Safety stock is at least the medicine's configured minimum stock.
 */
export function getReorderSuggestions(data: ProjectData, leadTimeDays = 3, windowDays = 30): ReorderSuggestion[] {
  return data.medicines.map((medicine: Medicine) => {
    const average = averageDailySales(data, medicine.id, windowDays);
    const safetyStock = Math.max(0, positiveNumber(medicine.minimumStock));
    const reorderPoint = Math.ceil(average * Math.max(0, leadTimeDays) + safetyStock);
    const stock = positiveNumber(medicine.stockQuantity);
    const suggested = Math.max(0, reorderPoint - stock);
    return {
      medicineId: medicine.id,
      medicineName: medicine.name,
      stockQuantity: stock,
      minimumStock: safetyStock,
      averageDailySales: average,
      leadTimeDays,
      safetyStock,
      reorderPoint,
      suggestedOrderQuantity: suggested,
      stockDaysRemaining: average > 0 ? stock / average : null,
    };
  }).filter(r => r.suggestedOrderQuantity > 0 || r.stockQuantity <= r.minimumStock)
    .sort((a, b) => b.suggestedOrderQuantity - a.suggestedOrderQuantity);
}

export function getDeadStock(data: ProjectData, thresholdDays = 90): DeadStockItem[] {
  const now = Date.now();
  return data.medicines.map((medicine: Medicine) => {
    const stock = positiveNumber(medicine.stockQuantity);
    const last = lastSaleDate(data, medicine.id);
    const days = last ? Math.max(0, Math.floor((now - Date.parse(last)) / dayMs())) : null;
    const purchaseValue = stock * positiveNumber(medicine.purchasePrice);
    const retailValue = stock * positiveNumber(medicine.salePrice);
    return { medicineId: medicine.id, medicineName: medicine.name, stockQuantity: stock, purchaseValue, retailValue, lastSaleDate: last, daysSinceLastSale: days };
  }).filter(item => item.stockQuantity > 0 && (item.daysSinceLastSale === null || item.daysSinceLastSale >= thresholdDays))
    .sort((a, b) => b.purchaseValue - a.purchaseValue);
}
