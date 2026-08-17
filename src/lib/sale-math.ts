/** Single source of truth for sale money math. */
import type { Medicine, Sale } from "@/domain/schema";

function billedUnits(l:{quantity:number;unitQuantity?:number}){return l.unitQuantity??l.quantity;}
function baseUnits(l:{quantity:number;unitQuantity?:number;unitFactor?:number}){return l.unitQuantity!=null?l.unitQuantity*(l.unitFactor??1):l.quantity;}
export function saleSubtotal(sale: Sale): number { return sale.items.reduce((a,l)=>a+l.salePrice*billedUnits(l)*(1-l.discountPercent/100),0); }
export function saleTax(sale: Sale): number { return saleSubtotal(sale) * ((sale.taxPercent || 0) / 100); }
export function saleDiscountValue(sale: Sale): number {
  const gross = saleSubtotal(sale) + saleTax(sale);
  return gross * ((sale.discount || 0) / 100);
}
export function saleTotal(sale: Sale): number {
  const gross = saleSubtotal(sale) + saleTax(sale);
  return Math.max(0, gross - gross * ((sale.discount || 0) / 100));
}
export function saleProfit(sale: Sale, medicines: Medicine[]): number {
  const cost = sale.items.reduce((a, l) => {
    const m = medicines.find((x) => x.id === l.medicineId);
    const historicalCost = l.costPriceAtSale;
    return a + (historicalCost ?? m?.purchasePrice ?? 0) * baseUnits(l);
  }, 0);
  return saleTotal(sale) - cost;
}
export function cartTotals(lines: { salePrice: number; quantity: number; discountPercent: number; unitQuantity?: number }[], taxPercent: number, discountPercent: number) {
  const subtotal = lines.reduce((a,l)=>a+l.salePrice*(l.unitQuantity??l.quantity)*(1-l.discountPercent/100),0);
  const tax = subtotal * ((taxPercent || 0) / 100);
  const gross = subtotal + tax;
  const discountValue = gross * ((discountPercent || 0) / 100);
  return { subtotal, tax, gross, discountValue, total: Math.max(0, gross - discountValue) };
}
