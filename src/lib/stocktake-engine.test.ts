import { describe, expect, it } from "vitest";
import { beginStockTake, createDisposition, postStockTake, updateStockTakeLine } from "./stocktake-engine";

function project() {
  const batch = { id: "b1", medicineId: "m1", batchNumber: "A", quantity: 10, initialQuantity: 10, purchasePrice: 50, expiryDate: "2028-01-01", receivedDate: "2026-01-01" };
  return { meta:{id:"p",name:"Test",createdAt:"",updatedAt:"",schemaVersion:8}, settings:{pharmacyName:"Test",ownerName:"",phone:"",email:"",address:"",taxPercent:0,currency:"PKR",currencySymbol:"₨",receiptFooter:"",billFooter1:"",billFooter2:"",autoSaveEnabled:false,autoSaveIntervalMinutes:5,theme:"light",passwordProtected:false,inventoryBatches:[batch],stockTakes:[],inventoryDispositions:[],stockAdjustments:[]}, categories:[], suppliers:[{id:"s1",name:"Supplier",balance:0}], customers:[], medicines:[{id:"m1",name:"Medicine",purchasePrice:50,salePrice:80,mrp:80,stockQuantity:10,minimumStock:1}], purchases:[],sales:[],stockAdjustments:[] } as any;
}

describe("stocktake engine",()=>{
  it("requires a reason for a variance and reconciles the exact batch",()=>{const d=project();const t=beginStockTake(d);updateStockTakeLine(t,"b1",8);expect(()=>postStockTake(d,t.id)).toThrow(/Reason required/);updateStockTakeLine(t,"b1",8,"counted shortage");postStockTake(d,t.id,"tester");expect(d.settings.inventoryBatches[0].quantity).toBe(8);expect(d.medicines[0].stockQuantity).toBe(8);expect(d.stockAdjustments[0].delta).toBe(-2);});
  it("does not allow expired disposition on a valid batch",()=>{const d=project();expect(()=>createDisposition(d,"expired","b1",1,"test")).toThrow(/not expired/);});
  it("reduces only the selected batch for supplier return",()=>{const d=project();const r=createDisposition(d,"supplier_return","b1",3,"return", "s1", "tester");expect(r.lines[0].batchId).toBe("b1");expect(d.settings.inventoryBatches[0].quantity).toBe(7);expect(d.medicines[0].stockQuantity).toBe(7);});
});
