/** Central catalog for pharmacy notification preferences. */
export const NOTIFICATION_TYPES = [
  "messageReceived","medicineAdd","medicineEdit","medicineDelete","medicinePriceChange","medicineMrpChange","medicineStockChange","medicineLowStock","medicineOutOfStock","medicineExpirySoon","medicineExpired","medicineBatchAdd","medicineBatchEdit","medicineBatchDelete",
  "saleCompleted","forceSale","largeSale","saleCancelled","saleEdited","saleReturned","partialSaleReturn","fullSaleReturn","salePriceChanged","discountApplied","largeDiscount","taxChanged","paymentReceived","paymentPartial","creditSale","customerAdd","customerEdit","customerDelete","customerPayment","customerCreditLimit","customerBalanceHigh",
  "purchaseAdd","purchaseEdit","purchaseDelete","purchaseReturned","partialPurchaseReturn","fullPurchaseReturn","purchasePriceChanged","supplierAdd","supplierEdit","supplierDelete","supplierPayment","supplierBalanceHigh","supplierInvoiceDuplicate",
  "categoryAdd","categoryEdit","categoryDelete","inventoryBatchAdd","inventoryBatchLowStock","inventoryBatchExpired","inventoryAdjustment","stockTransfer","stockCorrection","negativeStockPrevented","prescriptionAdd","prescriptionEdit","prescriptionDelete","prescriptionDueSoon","prescriptionDueToday","prescriptionVisitLoaded","prescriptionMedicineOutOfStock","prescriptionVisibilityChanged","backupCreated","backupFailed","backupRestored","loginSuccess","loginFailed","userCreated","userEdited","userDeleted","permissionChanged","serverConnected","serverDisconnected","syncConflict","syncCompleted","dataSaveFailed","dataRestored","printerFailed","printCompleted","returnRejected","mrpValidationFailed","checkoutPriceChanged","settingsChanged","pinAdded","pinRemoved","reportExported","reportPrinted",
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

/** Defaults: safety, stock and scheduled-care events are enabled. */
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<NotificationType, boolean> = Object.fromEntries(
  NOTIFICATION_TYPES.map((type) => [type, [
    "messageReceived","forceSale","medicineLowStock","medicineOutOfStock","medicineExpirySoon","medicineExpired","saleReturned","purchaseReturned","customerPayment","supplierPayment","syncConflict","dataSaveFailed","backupFailed","printerFailed","negativeStockPrevented","mrpValidationFailed","returnRejected","checkoutPriceChanged","prescriptionAdd","prescriptionDueSoon","prescriptionDueToday","prescriptionMedicineOutOfStock","prescriptionVisitLoaded",
  ].includes(type)])
) as Record<NotificationType, boolean>;

export const NOTIFICATION_LABELS: Record<NotificationType, string> = Object.fromEntries(
  NOTIFICATION_TYPES.map((type) => [type, type.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())])
) as Record<NotificationType, string>;
