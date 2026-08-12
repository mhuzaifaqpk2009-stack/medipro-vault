/** Audit trail used for admin notifications and force-sale reporting in every mode. */
import { isClientMode } from "./install";
import { serverLogAudit, serverGetAuditLog, serverGetRecentEvents } from "./server-api";

export interface AuditEntry {
  id: string;
  entityType: "medicine" | "sale" | "customer" | "purchase" | "supplier" | "category";
  entityId: string;
  action: "add" | "edit" | "delete" | "force-sale";
  username?: string;
  userId?: string;
  medicineName?: string;
  quantity?: number;
  price?: number;
  timestamp: string;
}
interface ElectronAuditAPI { add: (entry: AuditEntry) => Promise<boolean>; forEntity: (entityType: string, entityId: string) => Promise<AuditEntry[]>; since: (isoTimestamp: string) => Promise<AuditEntry[]>; }
function api(): ElectronAuditAPI | null { if (typeof window === "undefined") return null; return (window as unknown as { electronAPI?: { auditLog?: ElectronAuditAPI } }).electronAPI?.auditLog ?? null; }
async function write(entry: AuditEntry) { try { if (isClientMode()) await serverLogAudit(entry); else await api()?.add(entry); } catch (e) { console.error("[audit] failed", e); } }
export async function logMedicineAudit(entry: Omit<AuditEntry, "id" | "timestamp" | "entityType">) { await write({ ...entry, entityType: "medicine", id: crypto.randomUUID(), timestamp: new Date().toISOString() }); }
export async function logSaleEvent(saleId: string, amount: number, username?: string, userId?: string) { await write({ id: crypto.randomUUID(), entityType: "sale", entityId: saleId, action: "add", username, userId, price: amount, timestamp: new Date().toISOString() }); }
export async function logForceSaleEvent(saleId: string, medicineName: string, quantity: number, username?: string, userId?: string, price?: number) { await write({ id: crypto.randomUUID(), entityType: "sale", entityId: saleId, action: "force-sale", medicineName, quantity, username, userId, price, timestamp: new Date().toISOString() }); }
export async function logCustomerAddEvent(customerId: string, name: string, username?: string, userId?: string) { await write({ id: crypto.randomUUID(), entityType: "customer", entityId: customerId, action: "add", username, userId, medicineName: name, timestamp: new Date().toISOString() }); }
export async function getMedicineAuditLog(medicineId: string): Promise<AuditEntry[]> { try { if (isClientMode()) return ((await serverGetAuditLog("medicine", medicineId)).entries as AuditEntry[]) ?? []; return (await api()?.forEntity("medicine", medicineId)) ?? []; } catch { return []; } }
export async function getRecentEvents(sinceIso: string): Promise<AuditEntry[]> { try { if (isClientMode()) return ((await serverGetRecentEvents(sinceIso)).entries as AuditEntry[]) ?? []; return (await api()?.since(sinceIso)) ?? []; } catch { return []; } }