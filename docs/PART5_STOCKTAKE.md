# Part 5 — Advanced Stock Take + Expired / Return-to-Supplier Workflow

## Stock take
- Counts are captured at batch/lot level.
- A draft stock take never changes inventory.
- Physical variance is calculated against the batch quantity.
- A reason is required for every shortage or surplus.
- Posting changes only the affected batch quantities.
- Medicine aggregate stock is recalculated from batches.
- Every posted variance creates a stock adjustment/audit record.

## Expired stock
- Only batches whose expiry date has passed can be disposed as expired.
- Expired stock is removed from sellable inventory by reducing that exact batch.
- The disposition remains in history.

## Damaged stock
- A specific batch and quantity are selected.
- The quantity cannot exceed available batch stock.
- The batch is reduced and an auditable adjustment is recorded.

## Supplier return
- A specific batch and quantity are selected.
- A supplier is required.
- The batch is reduced and a supplier-return disposition is recorded.
- This workflow does not silently delete the original purchase history.

## Safety
- Disposition cannot make a batch negative.
- Expired disposition cannot be used on a non-expired batch.
- Stock take posting is blocked when a batch disappears between count and posting.
- Draft stock takes do not affect stock.
