import type { ProjectData, InventoryBatch, Medicine } from "@/domain/schema";

export type ExpiryAlert = { id: string; medicineId: string; medicineName: string; batchId?: string; batchNumber?: string; expiryDate: string; days: number; quantity: number; severity: "expired" | "urgent" | "soon" };
export function getExpiryAlerts(data: ProjectData, days = 30): ExpiryAlert[] {
  const now = new Date(); now.setHours(0,0,0,0); const batches = data.settings.inventoryBatches ?? []; const out: ExpiryAlert[] = [];
  const add=(m:Medicine, b:InventoryBatch)=>{ if(!b.expiryDate || b.quantity<=0) return; const d=new Date(b.expiryDate); d.setHours(0,0,0,0); const diff=Math.ceil((d.getTime()-now.getTime())/86400000); if(diff<=days) out.push({id:b.id,medicineId:m.id,medicineName:m.name,batchId:b.id,batchNumber:b.batchNumber,expiryDate:b.expiryDate,days:diff,quantity:b.quantity,severity:diff<0?"expired":diff<=7?"urgent":"soon"}); };
  for(const b of batches){ const m=data.medicines.find(x=>x.id===b.medicineId); if(m) add(m,b); }
  const covered=new Set(batches.map(b=>b.medicineId)); for(const m of data.medicines){ if(covered.has(m.id) || !m.expiryDate || m.stockQuantity<=0) continue; const d=new Date(m.expiryDate); d.setHours(0,0,0,0); const diff=Math.ceil((d.getTime()-now.getTime())/86400000); if(diff<=days) out.push({id:`medicine:${m.id}`,medicineId:m.id,medicineName:m.name,expiryDate:m.expiryDate,days:diff,quantity:m.stockQuantity,severity:diff<0?"expired":diff<=7?"urgent":"soon"}); }
  return out.sort((a,b)=>a.days-b.days);
}
