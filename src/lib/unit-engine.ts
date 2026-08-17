import type { Medicine, MedicineUnitOption, ProjectData } from "@/domain/schema";
export function unitOptions(m?: Medicine): MedicineUnitOption[] { return m?.unitConfig?.options?.filter(x=>x.factor>0&&x.label.trim())??[]; }
export function defaultUnit(m?: Medicine): MedicineUnitOption|undefined { return unitOptions(m)[0]; }
export function baseQuantity(q:number,f:number){ return Math.max(0,Math.floor(Number(q||0)*Number(f||1))); }
export function configureUnits(data:ProjectData,id:string,base:string,options:MedicineUnitOption[]){const m=data.medicines.find(x=>x.id===id);if(!m)return;m.unitConfig=options.length?{baseUnit:base||"piece",options}:undefined;}
