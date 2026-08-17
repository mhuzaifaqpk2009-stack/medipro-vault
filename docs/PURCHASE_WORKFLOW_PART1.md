# Part 1 — Purchase → GRN → Invoice → Supplier Payable

## Rules

1. A Purchase Order reserves intent only. It does **not** increase stock or supplier payable.
2. A posted Goods Receipt increases stock and creates the received batches. Partial receipts are supported.
3. Every received line must carry a batch/lot, expiry date, quantity and unit cost. Bonus/free quantity is tracked separately from paid quantity.
4. A Purchase Invoice records the supplier's invoice number and financial total. The invoice may reference one or more GRNs.
5. Supplier payable is invoice-based. `balance = total - allocated supplier payments`.
6. Supplier payments can be partial and can be allocated across multiple invoices, but never exceed an invoice's outstanding balance.
7. Cancelling a posted GRN must reverse only the stock/batches created by that GRN and must be blocked if later sales have consumed those units unless a controlled reversal workflow is used.
8. Cancelling an invoice does not silently delete the GRN or stock. It reverses the financial payable only when business rules permit it.
9. PO status is derived from posted GRNs: ordered → partial → received.
10. All posting/cancellation/payment actions must remain auditable.

## Example

PO: 100 boxes at Rs 100.

GRN 1: 60 boxes, batch A, plus 5 free.
GRN 2: 40 boxes, batch B.

Stock received = 105 boxes.
Supplier invoice = Rs 10,000 (paid quantity only).
If Rs 3,000 is paid, supplier payable = Rs 7,000.

The free 5 boxes affect stock and cost allocation but do not create Rs 500 of supplier debt.
