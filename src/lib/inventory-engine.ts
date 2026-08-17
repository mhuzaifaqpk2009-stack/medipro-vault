import type { InventoryBatch, ProjectData, SaleItem } from "@/domain/schema";
import { uid } from "@/lib/format";

/** Batch inventory is the lot-level source of truth. */
export function syncInventoryBatches(data: ProjectData): void {
  if (!data.settings.inventoryBatches) data.settings.inventoryBatches = [];
  const batches = data.settings.inventoryBatches;
  const known = new Set(batches.map((b) => b.sourceKey).filter(Boolean));

  for (const medicine of data.medicines) {
    const legacyKey = `legacy:${medicine.id}`;
    if (!known.has(legacyKey)) {
      batches.push({ id: uid("batch_"), sourceKey: legacyKey, medicineId: medicine.id, batchNumber: medicine.batchNumber, barcode: medicine.barcode, quantity: Math.max(0, medicine.stockQuantity || 0), initialQuantity: Math.max(0, medicine.stockQuantity || 0), purchasePrice: medicine.purchasePrice || 0, expiryDate: medicine.expiryDate, manufactureDate: medicine.manufactureDate, receivedDate: new Date().toISOString() });
    }
  }

  // A new purchase already increased medicine.stockQuantity. Move that newly
  // received quantity out of the aggregate legacy bucket and into a real lot,
  // so the batch total never double-counts stock.
  for (const purchase of data.purchases) {
    purchase.items.forEach((item, index) => {
      const sourceKey = `purchase:${purchase.id}:${index}`;
      if (batches.some((b) => b.sourceKey === sourceKey)) return;
      const legacy = batches.find((b) => b.sourceKey === `legacy:${item.medicineId}`);
      const qty = Math.max(0, item.quantity);
      if (legacy) legacy.quantity = Math.max(0, legacy.quantity - qty);
      batches.push({ id: uid("batch_"), sourceKey, purchaseId: purchase.id, purchaseItemIndex: index, medicineId: item.medicineId, batchNumber: item.batchNumber, quantity: qty, initialQuantity: qty, purchasePrice: item.purchasePrice, expiryDate: item.expiryDate, receivedDate: purchase.receivedDate ?? purchase.purchaseDate, barcode: data.medicines.find((m) => m.id === item.medicineId)?.barcode });
    });
  }

  for (const medicine of data.medicines) {
    const total = batches.filter((b) => b.medicineId === medicine.id).reduce((sum, b) => sum + Math.max(0, b.quantity), 0);
    medicine.stockQuantity = total;
  }
}

export interface BatchAllocation { batchId: string; quantity: number; costPrice: number; }

/** Allocate stock FEFO: earliest expiry first, then FIFO by received date. */
export function allocateStock(data: ProjectData, medicineId: string, quantity: number, allowForce: boolean): { allocations: BatchAllocation[]; forcedQuantity: number } {
  syncInventoryBatches(data);
  const batches = (data.settings.inventoryBatches ?? []).filter((b) => b.medicineId === medicineId && b.quantity > 0).sort((a, b) => {
    const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
    const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (ae !== be) return ae - be;
    return new Date(a.receivedDate ?? "9999-12-31").getTime() - new Date(b.receivedDate ?? "9999-12-31").getTime();
  });
  let remaining = Math.max(0, Math.floor(quantity));
  const allocations: BatchAllocation[] = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(0, batch.quantity));
    if (!take) continue;
    batch.quantity -= take;
    allocations.push({ batchId: batch.id, quantity: take, costPrice: batch.purchasePrice });
    remaining -= take;
  }
  if (remaining > 0 && !allowForce) {
    for (const a of allocations) { const b = batches.find((x) => x.id === a.batchId); if (b) b.quantity += a.quantity; }
    return { allocations: [], forcedQuantity: remaining };
  }
  const med = data.medicines.find((m) => m.id === medicineId);
  if (med) med.stockQuantity = Math.max(0, med.stockQuantity - quantity);
  return { allocations, forcedQuantity: remaining };
}

export function allocationsForSaleItem(item: SaleItem): BatchAllocation[] {
  if (item.batchAllocations?.length) return item.batchAllocations;
  if (item.batchId) return [{ batchId: item.batchId, quantity: item.quantity, costPrice: item.costPriceAtSale ?? 0 }];
  return [];
}

export function weightedCost(allocations: BatchAllocation[], fallback: number, quantity: number): number {
  if (!allocations.length || quantity <= 0) return fallback;
  const cost = allocations.reduce((sum, a) => sum + a.quantity * a.costPrice, 0);
  const allocatedQty = allocations.reduce((sum, a) => sum + a.quantity, 0);
  return allocatedQty ? cost / allocatedQty : fallback;
}
