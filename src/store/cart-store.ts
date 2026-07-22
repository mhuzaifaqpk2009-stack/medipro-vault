import { create } from "zustand";
import type { SaleItem, PaymentMethod } from "@/domain/schema";

export interface CartLine extends SaleItem {
  name: string;
  forced?: boolean;
}

interface CartState {
  cart: CartLine[];
  customerId: string;
  remark: string;
  discount: number;
  taxPercent: number | null;
  method: PaymentMethod;
  received: number;
  printBill: boolean;
  setCart(next: CartLine[] | ((prev: CartLine[]) => CartLine[])): void;
  setCustomerId(v: string): void;
  setRemark(v: string): void;
  setDiscount(v: number): void;
  setTaxPercent(v: number): void;
  setMethod(v: PaymentMethod): void;
  setReceived(v: number): void;
  setPrintBill(v: boolean): void;
  reset(): void;
}

export const useCartStore = create<CartState>((set) => ({
  cart: [],
  customerId: "",
  remark: "",
  discount: 0,
  taxPercent: null,
  method: "cash",
  received: 0,
  printBill: true,
  setCart: (next) =>
    set((s) => ({ cart: typeof next === "function" ? (next as (p: CartLine[]) => CartLine[])(s.cart) : next })),
  setCustomerId: (v) => set({ customerId: v }),
  setRemark: (v) => set({ remark: v }),
  setDiscount: (v) => set({ discount: v }),
  setTaxPercent: (v) => set({ taxPercent: v }),
  setMethod: (v) => set({ method: v }),
  setReceived: (v) => set({ received: v }),
  setPrintBill: (v) => set({ printBill: v }),
  reset: () =>
    set({
      cart: [],
      customerId: "",
      remark: "",
      discount: 0,
      received: 0,
    }),
}));
