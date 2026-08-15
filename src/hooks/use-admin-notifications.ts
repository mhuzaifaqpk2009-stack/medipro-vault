import { useEffect } from "react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { useNotificationStore, type NotificationType } from "@/store/notification-store";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notification-types";
import type { PharmacySettings } from "@/domain/schema";

const NOTIFICATION_CURSOR_KEY = "medicore.admin-notification-audit-cursor";
function readCursor(): string | null { try { return localStorage.getItem(NOTIFICATION_CURSOR_KEY); } catch { return null; } }
function writeCursor(iso: string) { try { localStorage.setItem(NOTIFICATION_CURSOR_KEY, iso); } catch {} }

export function useAdminNotifications() {
  const settings = useProjectStore((s) => s.data?.settings);
  const user = useSession((s) => s.user);
  const addNotification = useNotificationStore((s) => s.add);
  const active = !!user && (user.role === "admin" || user.permissions.viewNotifications === true);
  const preferences = settings?.notificationPreferences ?? {};
  const threshold = settings?.largeSaleThreshold ?? 0;

  useEffect(() => {
    if (!active || !user) return;
    let cancelled = false; let timer: number | null = null;
    let cursor = readCursor();
    if (!cursor) cursor = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const tick = async () => {
      if (cancelled || !cursor) return;
      try {
        const parsed = Date.parse(cursor);
        const events = (await getRecentEvents(new Date(Math.max(0, parsed - 1)).toISOString())) as AuditEntry[];
        if (cancelled) return;
        let newest = cursor;
        for (const e of events) {
          if (e.timestamp > newest) newest = e.timestamp;
          if (e.userId && e.userId === user.id) continue;
          const type = matchType(e, threshold);
          if (!type || !isEnabled(type, preferences, settings, e)) continue;
          addNotification({ id: `audit:${e.id}`, type, username: e.username || "Someone", timestamp: e.timestamp, entityId: e.entityId, medicineName: e.medicineName, quantity: e.quantity, price: e.price });
        }
        if (events.length > 0) { cursor = newest; writeCursor(cursor); }
      } catch (e) { console.error("[notifications] audit sync failed", e); }
      if (!cancelled) timer = window.setTimeout(tick, 1000);
    };
    void tick();
    return () => { cancelled = true; if (timer !== null) window.clearTimeout(timer); };
  }, [active, user, preferences, threshold, settings, addNotification]);
}

function isEnabled(type: NotificationType, preferences: Record<string, boolean>, settings: PharmacySettings | undefined, e: AuditEntry) {
  const legacy: Partial<Record<NotificationType, boolean | undefined>> = {
    medicineDelete: settings?.notifyOnDeleteMedicine,
    medicineAdd: settings?.notifyOnAddMedicine,
    customerAdd: settings?.notifyOnAddCustomer,
    forceSale: settings?.notifyOnForceSale,
    largeSale: settings?.notifyOnLargeSale,
  };
  if (legacy[type] !== undefined) return legacy[type] === true;
  void e;
  return preferences[type] ?? DEFAULT_NOTIFICATION_PREFERENCES[type];
}

function matchType(e: AuditEntry, threshold: number): NotificationType | null {
  if (e.entityType === "medicine" && e.action === "delete") return "medicineDelete";
  if (e.entityType === "medicine" && e.action === "add") return "medicineAdd";
  if (e.entityType === "medicine" && e.action === "edit") return "medicineEdit";
  if (e.entityType === "customer" && e.action === "add") return "customerAdd";
  if (e.entityType === "customer" && e.action === "edit") return "customerEdit";
  if (e.entityType === "customer" && e.action === "delete") return "customerDelete";
  if (e.entityType === "sale" && e.action === "force-sale") return "forceSale";
  if (e.entityType === "sale" && e.action === "add") return (e.price ?? 0) > threshold && threshold > 0 ? "largeSale" : "saleCompleted";
  if (e.entityType === "sale" && e.action === "edit") return "saleEdited";
  if (e.entityType === "purchase" && e.action === "add") return "purchaseAdd";
  if (e.entityType === "purchase" && e.action === "edit") return "purchaseEdit";
  if (e.entityType === "purchase" && e.action === "delete") return "purchaseDelete";
  if (e.entityType === "supplier" && e.action === "add") return "supplierAdd";
  if (e.entityType === "supplier" && e.action === "edit") return "supplierEdit";
  if (e.entityType === "supplier" && e.action === "delete") return "supplierDelete";
  if (e.entityType === "category" && e.action === "add") return "categoryAdd";
  if (e.entityType === "category" && e.action === "edit") return "categoryEdit";
  if (e.entityType === "category" && e.action === "delete") return "categoryDelete";
  return null;
}
