/**
 * Single source of truth for sale money math.
 *
 * `Sale.discount` is a PERCENTAGE applied to the gross (subtotal + tax),
 * matching the printed receipt.
 */
import type { Medicine, Sale } from "@/domain/schema";

export function saleSubtotal(sale: Sale): number {
  return sale.items.reduce(
    (a, l) => a + l.salePrice * l.quantity * (1 - l.discountPercent / 100),
    0,
  );
}

export function saleTax(sale: Sale): number {
  return saleSubtotal(sale) * ((sale.taxPercent || 0) / 100);
}

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
    return a + (m?.purchasePrice ?? 0) * l.quantity;
  }, 0);
  return saleTotal(sale) - cost;
}

/** Totals for an in-progress cart where `discountPercent` is a percentage. */
export function cartTotals(
  lines: { salePrice: number; quantity: number; discountPercent: number }[],
  taxPercent: number,
  discountPercent: number,
) {
  const subtotal = lines.reduce(
    (a, l) => a + l.salePrice * l.quantity * (1 - l.discountPercent / 100),
    0,
  );
  const tax = subtotal * ((taxPercent || 0) / 100);
  const gross = subtotal + tax;
  const discountValue = gross * ((discountPercent || 0) / 100);
  return { subtotal, tax, gross, discountValue, total: Math.max(0, gross - discountValue) };
}
