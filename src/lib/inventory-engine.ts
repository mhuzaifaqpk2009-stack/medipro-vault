import type { ProjectData, SaleItem } from "@/domain/schema";
import { uid } from "@/lib/format";

/** Batch inventory is the lot-level source of truth. */
export function syncInventoryBatches(data: ProjectData): void {
  if (!data.settings.inventoryBatches) data.settings.inventoryBatches = [];
  const batches = data.settings.inventoryBatches;

  // One-time migration. If the user already has manually maintained batches,
  // keep those quantities. Otherwise preserve legacy aggregate stock in one
  // synthetic batch per medicine. Historical purchases are metadata-only
  // during migration because their quantities may already be partly sold.
  if ((data.settings.inventoryBatchMigrationVersion ?? 0) < 1) {
    if (batches.length === 0) {
      for (const medicine of data.medicines) {
        batches.push({ id: uid("batch_"), sourceKey: `legacy:${medicine.id}`, medicineId: medicine.id, batchNumber: medicine.batchNumber, barcode: medicine.barcode, quantity: Math.max(0, medicine.stockQuantity || 0), initialQuantity: Math.max(0, medicine.stockQuantity || 0), purchasePrice: medicine.purchasePrice || 0, expiryDate: medicine.expiryDate, manufactureDate: medicine.manufactureDate, receivedDate: new Date().toISOString() });
      }
    }
    for (const purchase of data.purchases) purchase.items.forEach((item, index) => {
      const sourceKey = `purchase:${purchase.id}:${index}`;
      if (!batches.some((b) => b.sourceKey === sourceKey)) batches.push({ id: uid("batch_"), sourceKey, purchaseId: purchase.id, purchaseItemIndex: index, medicineId: item.medicineId, batchNumber: item.batchNumber, barcode: data.medicines.find(m => m.id === item.medicineId)?.barcode, quantity: 0, initialQuantity: item.quantity, purchasePrice: item.purchasePrice, expiryDate: item.expiryDate, receivedDate: purchase.receivedDate ?? purchase.purchaseDate });
    });
    data.settings.inventoryBatchMigrationVersion = 1;
  }

  // Purchases created after migration become real stock lots. Existing source
  // keys are never recreated, so consumed stock cannot magically return.
  for (const purchase of data.purchases) purchase.items.forEach((item, index) => {
    const sourceKey = `purchase:${purchase.id}:${index}`;
    if (batches.some((b) => b.sourceKey === sourceKey)) return;
    batches.push({ id: uid("batch_"), sourceKey, purchaseId: purchase.id, purchaseItemIndex: index, medicineId: item.medicineId, batchNumber: item.batchNumber, quantity: Math.max(0, item.quantity), initialQuantity: Math.max(0, item.quantity), purchasePrice: item.purchasePrice, expiryDate: item.expiryDate, receivedDate: purchase.receivedDate ?? purchase.purchaseDate, barcode: data.medicines.find(m => m.id === item.medicineId)?.barcode });
  });

  for (const medicine of data.medicines) {
    const lots = batches.filter(b => b.medicineId === medicine.id);
    const total = lots.reduce((sum,b)=>sum+Math.max(0,b.quantity),0);
    medicine.stockQuantity = total;
  }
}

export interface BatchAllocation { batchId: string; quantity: number; costPrice: number; }
/** Allocate stock FEFO: earliest expiry first, then FIFO by received date. */
export function allocateStock(data: ProjectData, medicineId: string, quantity: number, allowForce: boolean): { allocations: BatchAllocation[]; forcedQuantity: number } {
  syncInventoryBatches(data);
  const batches=(data.settings.inventoryBatches??[]).filter(b=>b.medicineId===medicineId&&b.quantity>0).sort((a,b)=>{const ae=a.expiryDate?new Date(a.expiryDate).getTime():Number.MAX_SAFE_INTEGER;const be=b.expiryDate?new Date(b.expiryDate).getTime():Number.MAX_SAFE_INTEGER;if(ae!==be)return ae-be;return new Date(a.receivedDate??"9999-12-31").getTime()-new Date(b.receivedDate??"9999-12-31").getTime();});
  let remaining=Math.max(0,Math.floor(quantity)); const allocations:BatchAllocation[]=[];
  for(const batch of batches){if(remaining<=0)break;const take=Math.min(remaining,Math.max(0,batch.quantity));if(!take)continue;batch.quantity-=take;allocations.push({batchId:batch.id,quantity:take,costPrice:batch.purchasePrice});remaining-=take;}
  if(remaining>0&&!allowForce){for(const a of allocations){const b=batches.find(x=>x.id===a.batchId);if(b)b.quantity+=a.quantity;}return{allocations:[],forcedQuantity:remaining};}
  const med=data.medicines.find(m=>m.id===medicineId);if(med)med.stockQuantity=Math.max(0,med.stockQuantity-quantity);return{allocations,forcedQuantity:remaining};
}
export function allocationsForSaleItem(item:SaleItem):BatchAllocation[]{if(item.batchAllocations?.length)return item.batchAllocations;if(item.batchId)return[{batchId:item.batchId,quantity:item.quantity,costPrice:item.costPriceAtSale??0}];return[];}
export function weightedCost(allocations:BatchAllocation[],fallback:number,quantity:number):number{if(!allocations.length||quantity<=0)return fallback;const cost=allocations.reduce((sum,a)=>sum+a.quantity*a.costPrice,0);const allocatedQty=allocations.reduce((sum,a)=>sum+a.quantity,0);return allocatedQty?cost/allocatedQty:fallback;}
