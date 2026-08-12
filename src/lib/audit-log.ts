/**
 * Part 6: audit trail for medicine add/edit events. Multi computer mode
 * only — Single computer mode never logs or shows any of this, matching
 * the "zero visible difference" requirement for that mode.
 */
import { isClientMode, isMultiMode } from "./install";
import { serverLogAudit, serverGetAuditLog, serverGetRecentEvents } from "./server-api";

export interface AuditEntry {
  id: string;
  entityType: "medicine" | "sale" | "customer";
  entityId: string;
  action: "add" | "edit" | "delete";
  username?: string;
  userId?: string;
  medicineName?: string;
  quantity?: number;
  price?: number;
  timestamp: string;
}

interface ElectronAuditAPI {
  add: (entry: AuditEntry) => Promise<boolean>;
  forEntity: (entityType: string, entityId: string) => Promise<AuditEntry[]>;
  since: (isoTimestamp: string) => Promise<AuditEntry[]>;
}

function api(): ElectronAuditAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { electronAPI?: { auditLog?: ElectronAuditAPI } }).electronAPI?.auditLog ?? null;
}

/** Fire-and-forget: a logging failure should never block the actual medicine
 * save the user was doing, so every path here swallows its own errors. */
export async function logMedicineAudit(entry: Omit<AuditEntry, "id" | "timestamp" | "entityType">) {
  if (!isMultiMode()) return;
  const full: AuditEntry = {
    ...entry,
    entityType: "medicine",
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  try {
    if (isClientMode()) await serverLogAudit(full);
    else await api()?.add(full);
  } catch (e) {
    console.error("[audit] failed to log medicine change", e);
  }
}

/** Item 9: a sale event, so admin notifications can flag ones over threshold. */
export async function logSaleEvent(saleId: string, amount: number, username?: string, userId?: string) {
  if (!isMultiMode()) return;
  const full: AuditEntry = {
    id: crypto.randomUUID(), entityType: "sale", entityId: saleId, action: "add",
    username, userId, price: amount, timestamp: new Date().toISOString(),
  };
  try {
    if (isClientMode()) await serverLogAudit(full);
    else await api()?.add(full);
  } catch (e) {
    console.error("[audit] failed to log sale event", e);
  }
}

/** Item 9: a new customer, for the "someone added a customer" notification. */
export async function logCustomerAddEvent(customerId: string, name: string, username?: string, userId?: string) {
  if (!isMultiMode()) return;
  const full: AuditEntry = {
    id: crypto.randomUUID(), entityType: "customer", entityId: customerId, action: "add",
    username, userId, medicineName: name, timestamp: new Date().toISOString(),
  };
  try {
    if (isClientMode()) await serverLogAudit(full);
    else await api()?.add(full);
  } catch (e) {
    console.error("[audit] failed to log customer event", e);
  }
}

export async function getMedicineAuditLog(medicineId: string): Promise<AuditEntry[]> {
  try {
    if (isClientMode()) {
      const res = await serverGetAuditLog("medicine", medicineId);
      return (res.entries as AuditEntry[]) ?? [];
    }
    return (await api()?.forEntity("medicine", medicineId)) ?? [];
  } catch (e) {
    console.error("[audit] failed to load medicine history", e);
    return [];
  }
}

/** Item 9: everything logged after a given timestamp, across all event
 * types — what the admin notification poller reads. */
export async function getRecentEvents(sinceIso: string): Promise<AuditEntry[]> {
  try {
    if (isClientMode()) {
      const res = await serverGetRecentEvents(sinceIso);
      return (res.entries as AuditEntry[]) ?? [];
    }
    return (await api()?.since(sinceIso)) ?? [];
  } catch (e) {
    console.error("[audit] failed to load recent events", e);
    return [];
  }
}
