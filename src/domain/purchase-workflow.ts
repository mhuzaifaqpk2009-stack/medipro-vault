export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
export type GoodsReceiptStatus = 'draft' | 'posted' | 'cancelled'
export type PurchaseInvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled'

export interface PurchaseOrderLine {
  medicineId: string
  quantityOrdered: number
  unitCost: number
  bonusQuantity?: number
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  poNumber: string
  date: string
  expectedDate?: string
  status: PurchaseOrderStatus
  lines: PurchaseOrderLine[]
  notes?: string
}

export interface GoodsReceiptLine {
  medicineId: string
  quantityReceived: number
  bonusQuantity?: number
  batchNumber: string
  expiryDate: string
  unitCost: number
  purchaseOrderLineId?: string
}

export interface GoodsReceipt {
  id: string
  supplierId: string
  purchaseOrderId?: string
  grnNumber: string
  receivedAt: string
  status: GoodsReceiptStatus
  lines: GoodsReceiptLine[]
  notes?: string
}

export interface PurchaseInvoice {
  id: string
  supplierId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  purchaseOrderId?: string
  goodsReceiptIds: string[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  balance: number
  status: PurchaseInvoiceStatus
  notes?: string
}

export interface SupplierPaymentAllocation {
  invoiceId: string
  amount: number
}

export interface SupplierPayment {
  id: string
  supplierId: string
  paidAt: string
  amount: number
  method: 'cash' | 'card' | 'bank' | 'online' | 'other'
  reference?: string
  allocations: SupplierPaymentAllocation[]
  notes?: string
}

export function getInvoiceStatus(total: number, paid: number): PurchaseInvoiceStatus {
  if (paid <= 0) return 'unpaid'
  if (paid + 0.005 >= total) return 'paid'
  return 'partial'
}

export function calculateInvoiceBalance(total: number, paid: number) {
  return Math.max(0, Number((total - paid).toFixed(2)))
}

export function validateReceiptAgainstOrder(order: PurchaseOrder, receipt: GoodsReceipt) {
  if (receipt.purchaseOrderId && receipt.purchaseOrderId !== order.id) {
    throw new Error('Goods receipt does not belong to this purchase order')
  }
  for (const line of receipt.lines) {
    const ordered = order.lines.find((item) => item.medicineId === line.medicineId)
    if (!ordered) throw new Error(`Medicine ${line.medicineId} is not on the purchase order`)
    if (line.quantityReceived < 0 || (line.bonusQuantity ?? 0) < 0) {
      throw new Error('Received and bonus quantities cannot be negative')
    }
  }
}

export function calculatePurchaseOrderStatus(order: PurchaseOrder, receipts: GoodsReceipt[]) {
  if (order.status === 'cancelled') return 'cancelled' as const
  const posted = receipts.filter((receipt) => receipt.status === 'posted' && receipt.purchaseOrderId === order.id)
  if (!posted.length) return order.status === 'draft' ? 'draft' as const : 'ordered' as const
  const receivedByMedicine = new Map<string, number>()
  for (const receipt of posted) {
    for (const line of receipt.lines) {
      receivedByMedicine.set(line.medicineId, (receivedByMedicine.get(line.medicineId) ?? 0) + line.quantityReceived + (line.bonusQuantity ?? 0))
    }
  }
  const complete = order.lines.every((line) => (receivedByMedicine.get(line.medicineId) ?? 0) >= line.quantityOrdered)
  return complete ? 'received' as const : 'partial' as const
}
