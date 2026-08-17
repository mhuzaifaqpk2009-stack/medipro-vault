import type { InventoryDisposition, InventoryDispositionKind, ProjectData, StockTake, StockTakeLine } from "@/domain/schema";
import { uid } from "@/lib/format";
import { isBatchExpired, reconcileMedicineStock } from "@/lib/inventory-engine";

export function beginStockTake(data: ProjectData, createdBy?: string): StockTake {
  const batches = data.settings.inventoryBatches ?? [];
  const lines: StockTakeLine[] = batches.filter(b => b.quantity > 0).map(b => ({
    medicineId: b.medicineId, batchId: b.id, systemQuantity: Math.max(0, b.quantity), countedQuantity: Math.max(0, b.quantity),
    variance: 0, unitCost: b.purchasePrice,
  }));
  const take: StockTake = { id: uid("take_"), number: `ST-${Date.now()}`, startedAt: new Date().toISOString(), status: "draft", lines, createdBy };
  data.settings.stockTakes ??= [];
  data.settings.stockTakes.push(take);
  return take;
}

export function updateStockTakeLine(take: StockTake, batchId: string, countedQuantity: number, reason?: string) {
  const line = take.lines.find(x => x.batchId === batchId);
  if (!line) throw new Error("Batch is not part of this stock take");
  if (!Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error("Counted quantity must be zero or greater");
  line.countedQuantity = Math.floor(countedQuantity);
  line.variance = line.countedQuantity - line.systemQuantity;
  line.reason = reason?.trim() || undefined;
}

export function postStockTake(data: ProjectData, takeId: string, postedBy?: string) {
  const take = (data.settings.stockTakes ?? []).find(x => x.id === takeId);
  if (!take || take.status !== "draft") throw new Error("Stock take is not editable");
  for (const line of take.lines) {
    const batch = (data.settings.inventoryBatches ?? []).find(b => b.id === line.batchId && b.medicineId === line.medicineId);
    if (!batch) throw new Error("A batch in this stock take no longer exists");
    if (line.countedQuantity < 0) throw new Error("Invalid physical count");
    if (line.variance !== 0 && !line.reason) throw new Error(`Reason required for ${line.variance > 0 ? "surplus" : "shortage"} on batch ${batch.batchNumber || batch.id}`);
    if (line.variance !== 0) {
      data.stockAdjustments.push({ id: uid("adj_"), medicineId: line.medicineId, batchId: line.batchId, date: new Date().toISOString(), delta: line.variance, reason: `Stock take ${take.number}: ${line.reason}`, kind: "stocktake", createdBy: postedBy });
      batch.quantity = line.countedQuantity;
    }
  }
  reconcileMedicineStock(data);
  take.status = "posted";
  take.completedAt = new Date().toISOString();
  take.postedBy = postedBy;
}

export function createDisposition(data: ProjectData, kind: InventoryDispositionKind, batchId: string, quantity: number, reason: string, supplierId?: string, createdBy?: string): InventoryDisposition {
  const batch = (data.settings.inventoryBatches ?? []).find(b => b.id === batchId);
  if (!batch) throw new Error("Batch not found");
  const qty = Math.floor(quantity);
  if (qty <= 0 || qty > batch.quantity) throw new Error("Disposition quantity exceeds available batch stock");
  if (kind === "expired" && !isBatchExpired(batch.expiryDate)) throw new Error("This batch is not expired");
  if (kind === "supplier_return" && !supplierId) throw new Error("Select the supplier for a supplier return");
  const disposition: InventoryDisposition = { id: uid("disp_"), number: `DIS-${Date.now()}`, kind, date: new Date().toISOString(), status: "posted", supplierId, reason: reason.trim() || undefined, createdBy, lines: [{ medicineId: batch.medicineId, batchId: batch.id, quantity: qty, unitCost: batch.purchasePrice }] };
  batch.quantity -= qty;
  data.settings.inventoryDispositions ??= [];
  data.settings.inventoryDispositions.push(disposition);
  data.stockAdjustments.push({ id: uid("adj_"), medicineId: batch.medicineId, batchId: batch.id, date: disposition.date, delta: -qty, reason: `${kind === "supplier_return" ? "Supplier return" : kind === "expired" ? "Expired stock" : "Damaged stock"} ${disposition.number}: ${reason}`, kind: "writeoff", createdBy });
  reconcileMedicineStock(data);
  return disposition;
}

export function getBatchDispositionCandidates(data: ProjectData, kind: InventoryDispositionKind) {
  const batches = data.settings.inventoryBatches ?? [];
  return batches.filter(b => b.quantity > 0 && (kind === "expired" ? isBatchExpired(b.expiryDate) : true));
}
