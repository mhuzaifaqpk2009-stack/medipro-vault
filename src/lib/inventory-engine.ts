import type { ProjectData, SaleItem } from "@/domain/schema";
import { uid } from "@/lib/format";

/** Batch inventory is the lot-level source of truth. */
export function syncInventoryBatches(data: ProjectData): void {
  if (!data.settings.inventoryBatches) data.settings.inventoryBatches = [];
  const batches = data.settings.inventoryBatches;

  if ((data.settings.inventoryBatchMigrationVersion ?? 0) < 1) {
    if (batches.length === 0) for (const medicine of data.medicines) batches.push({ id: uid("batch_"), sourceKey: `legacy:${medicine.id}`, medicineId: medicine.id, batchNumber: medicine.batchNumber, barcode: medicine.barcode, quantity: Math.max(0, medicine.stockQuantity || 0), initialQuantity: Math.max(0, medicine.stockQuantity || 0), purchasePrice: medicine.purchasePrice || 0, expiryDate: medicine.expiryDate, manufactureDate: medicine.manufactureDate, receivedDate: new Date().toISOString() });
    for (const purchase of data.purchases) purchase.items.forEach((item,index)=>{const sourceKey=`purchase:${purchase.id}:${index}`;if(!batches.some(b=>b.sourceKey===sourceKey))batches.push({id:uid("batch_"),sourceKey,purchaseId:purchase.id,purchaseItemIndex:index,medicineId:item.medicineId,batchNumber:item.batchNumber,barcode:data.medicines.find(m=>m.id===item.medicineId)?.barcode,quantity:0,initialQuantity:item.quantity,purchasePrice:item.purchasePrice,expiryDate:item.expiryDate,receivedDate:purchase.receivedDate??purchase.purchaseDate});});
    data.settings.inventoryBatchMigrationVersion=1;
  }

  const livePurchaseKeys=new Set<string>();
  for(const purchase of data.purchases) purchase.items.forEach((item,index)=>{
    const sourceKey=`purchase:${purchase.id}:${index}`; livePurchaseKeys.add(sourceKey);
    const existing=batches.find(b=>b.sourceKey===sourceKey);
    if(existing){
      const previouslySold=Math.max(0,(existing.initialQuantity??existing.quantity)-existing.quantity);
      existing.initialQuantity=Math.max(0,item.quantity); existing.quantity=Math.max(0,item.quantity-previouslySold); existing.purchasePrice=item.purchasePrice; existing.batchNumber=item.batchNumber; existing.expiryDate=item.expiryDate; existing.receivedDate=purchase.receivedDate??purchase.purchaseDate;
    } else batches.push({id:uid("batch_"),sourceKey,purchaseId:purchase.id,purchaseItemIndex:index,medicineId:item.medicineId,batchNumber:item.batchNumber,quantity:Math.max(0,item.quantity),initialQuantity:Math.max(0,item.quantity),purchasePrice:item.purchasePrice,expiryDate:item.expiryDate,receivedDate:purchase.receivedDate??purchase.purchaseDate,barcode:data.medicines.find(m=>m.id===item.medicineId)?.barcode});
  });
  for(const batch of batches) if(batch.sourceKey?.startsWith("purchase:")&&!livePurchaseKeys.has(batch.sourceKey)) batch.quantity=0;
  reconcileMedicineStock(data);
}

/** Returns true only after the batch's printed expiry date has ended. */
export function isBatchExpired(expiryDate?: string, now = new Date()): boolean {
  if(!expiryDate) return false;
  return expiryDate.slice(0,10) < now.toISOString().slice(0,10);
}

/** Expired batches remain in history but are excluded from sellable stock. */
export function sellableBatches(data: ProjectData, medicineId: string, now = new Date()) {
  return (data.settings.inventoryBatches??[]).filter(b=>b.medicineId===medicineId&&b.quantity>0&&!isBatchExpired(b.expiryDate,now));
}

/** Recalculate medicine aggregate stock from batch quantities. */
export function reconcileMedicineStock(data: ProjectData): void {
  const batches=data.settings.inventoryBatches??[];
  for(const medicine of data.medicines) medicine.stockQuantity=batches.filter(b=>b.medicineId===medicine.id).reduce((sum,b)=>sum+Math.max(0,b.quantity),0);
}

export interface BatchReconciliation { medicineId:string; medicineName:string; batchCount:number; totalBatchQuantity:number; medicineQuantity:number; difference:number; expiredQuantity:number; }

/** Returns discrepancies without mutating inventory; useful for stock-take/audit screens. */
export function getBatchReconciliation(data: ProjectData, now = new Date()): BatchReconciliation[] {
  const batches=data.settings.inventoryBatches??[];
  return data.medicines.map(medicine=>{
    const lots=batches.filter(b=>b.medicineId===medicine.id);
    const total=lots.reduce((sum,b)=>sum+Math.max(0,b.quantity),0);
    const expired=lots.filter(b=>isBatchExpired(b.expiryDate,now)).reduce((sum,b)=>sum+Math.max(0,b.quantity),0);
    return {medicineId:medicine.id,medicineName:medicine.name,batchCount:lots.length,totalBatchQuantity:total,medicineQuantity:Math.max(0,medicine.stockQuantity||0),difference:total-(medicine.stockQuantity||0),expiredQuantity:expired};
  }).filter(x=>x.batchCount>0&&(x.difference!==0||x.expiredQuantity>0));
}

export interface BatchAllocation { batchId:string; quantity:number; costPrice:number; }
/** Allocate stock FEFO: earliest valid expiry first, then FIFO by received date. Expired lots are never sellable. */
export function allocateStock(data:ProjectData,medicineId:string,quantity:number,allowForce:boolean):{allocations:BatchAllocation[];forcedQuantity:number;expiredQuantity:number}{
  syncInventoryBatches(data);
  const allBatches=(data.settings.inventoryBatches??[]).filter(b=>b.medicineId===medicineId&&b.quantity>0);
  const expiredQuantity=allBatches.filter(b=>isBatchExpired(b.expiryDate)).reduce((sum,b)=>sum+b.quantity,0);
  const batches=sellableBatches(data,medicineId).sort((a,b)=>{
    const ae=a.expiryDate?new Date(a.expiryDate).getTime():Number.MAX_SAFE_INTEGER; const be=b.expiryDate?new Date(b.expiryDate).getTime():Number.MAX_SAFE_INTEGER;
    if(ae!==be)return ae-be;
    return new Date(a.receivedDate??"9999-12-31").getTime()-new Date(b.receivedDate??"9999-12-31").getTime();
  });
  let remaining=Math.max(0,Math.floor(quantity)); const allocations:BatchAllocation[]=[];
  for(const batch of batches){if(remaining<=0)break;const take=Math.min(remaining,Math.max(0,batch.quantity));if(!take)continue;batch.quantity-=take;allocations.push({batchId:batch.id,quantity:take,costPrice:batch.purchasePrice});remaining-=take;}
  if(remaining>0){
    for(const a of allocations){const b=batches.find(x=>x.id===a.batchId);if(b)b.quantity+=a.quantity;}
    if(expiredQuantity>0) throw new Error("Sale blocked: the remaining stock is expired. Remove expired stock or receive a valid batch before selling.");
    if(!allowForce) return {allocations:[],forcedQuantity:remaining,expiredQuantity};
  }
  const med=data.medicines.find(m=>m.id===medicineId); if(med)med.stockQuantity=Math.max(0,med.stockQuantity-quantity);
  return {allocations,forcedQuantity:remaining,expiredQuantity};
}

export function allocationsForSaleItem(item:SaleItem):BatchAllocation[]{if(item.batchAllocations?.length)return item.batchAllocations;if(item.batchId)return[{batchId:item.batchId,quantity:item.quantity,costPrice:item.costPriceAtSale??0}];return[];}
export function weightedCost(allocations:BatchAllocation[],fallback:number,quantity:number):number{if(!allocations.length||quantity<=0)return fallback;const cost=allocations.reduce((sum,a)=>sum+a.quantity*a.costPrice,0);const allocatedQty=allocations.reduce((sum,a)=>sum+a.quantity,0);return allocatedQty?cost/allocatedQty:fallback;}
