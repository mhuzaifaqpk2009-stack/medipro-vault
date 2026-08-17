import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateInvoiceBalance, calculatePurchaseOrderStatus, getInvoiceStatus, validateReceiptAgainstOrder } from './purchase-workflow'

test('invoice status and balance', () => {
  assert.equal(getInvoiceStatus(1000, 0), 'unpaid')
  assert.equal(getInvoiceStatus(1000, 250), 'partial')
  assert.equal(getInvoiceStatus(1000, 1000), 'paid')
  assert.equal(calculateInvoiceBalance(1000, 275.5), 724.5)
})

test('partial and complete receiving', () => {
  const order = { id: 'po1', supplierId: 's1', poNumber: 'PO-1', date: '2026-08-17', status: 'ordered' as const, lines: [{ medicineId: 'm1', quantityOrdered: 100, unitCost: 10 }] }
  const partial = { id: 'grn1', supplierId: 's1', purchaseOrderId: 'po1', grnNumber: 'GRN-1', receivedAt: '2026-08-17', status: 'posted' as const, lines: [{ medicineId: 'm1', quantityReceived: 40, batchNumber: 'B1', expiryDate: '2027-01-01', unitCost: 10 }] }
  validateReceiptAgainstOrder(order, partial)
  assert.equal(calculatePurchaseOrderStatus(order, [partial]), 'partial')
  const complete = { ...partial, id: 'grn2', grnNumber: 'GRN-2', lines: [{ ...partial.lines[0], quantityReceived: 60, batchNumber: 'B2' }] }
  assert.equal(calculatePurchaseOrderStatus(order, [partial, complete]), 'received')
})

test('rejects receipt for an unlisted medicine', () => {
  const order = { id: 'po1', supplierId: 's1', poNumber: 'PO-1', date: '2026-08-17', status: 'ordered' as const, lines: [{ medicineId: 'm1', quantityOrdered: 10, unitCost: 10 }] }
  const receipt = { id: 'grn1', supplierId: 's1', purchaseOrderId: 'po1', grnNumber: 'GRN-1', receivedAt: '2026-08-17', status: 'posted' as const, lines: [{ medicineId: 'm2', quantityReceived: 1, batchNumber: 'B1', expiryDate: '2027-01-01', unitCost: 10 }] }
  assert.throws(() => validateReceiptAgainstOrder(order, receipt), /not on the purchase order/)
})
