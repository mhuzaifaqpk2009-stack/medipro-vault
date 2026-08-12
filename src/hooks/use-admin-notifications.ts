import { useEffect, useRef } from "react";
import { useProjectStore } from "@/store/project-store";
import { isAdmin } from "@/store/session-store";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { useNotificationStore, type NotificationType } from "@/store/notification-store";

/** Admin notification polling works in both Single and Multi computer modes. */
export function useAdminNotifications() {
  const settings = useProjectStore((s) => s.data?.settings);
  const addNotification = useNotificationStore((s) => s.add);
  const sinceRef = useRef<string | null>(null);
  const active = isAdmin();
  const notifyDelete = settings?.notifyOnDeleteMedicine ?? false;
  const notifyAdd = settings?.notifyOnAddMedicine ?? false;
  const notifyCustomer = settings?.notifyOnAddCustomer ?? false;
  const notifySale = settings?.notifyOnLargeSale ?? false;
  const notifyForce = settings?.notifyOnForceSale ?? true;
  const threshold = settings?.largeSaleThreshold ?? 0;

  useEffect(() => {
    if (!active) return;
    sinceRef.current = new Date().toISOString();
    const tick = async () => {
      if (!sinceRef.current) return;
      const events = await getRecentEvents(sinceRef.current);
      if (events.length === 0) return;
      for (const e of events as AuditEntry[]) {
        const type = matchType(e, { notifyDelete, notifyAdd, notifyCustomer, notifySale, notifyForce, threshold });
        if (type) addNotification({ id: e.id, type, username: e.username || "Someone", timestamp: e.timestamp, entityId: e.entityId, medicineName: e.medicineName, quantity: e.quantity, price: e.price });
      }
      sinceRef.current = events[events.length - 1].timestamp;
    };
    const id = window.setInterval(() => void tick(), 3000);
    return () => window.clearInterval(id);
  }, [active, notifyDelete, notifyAdd, notifyCustomer, notifySale, notifyForce, threshold, addNotification]);
}
function matchType(e: AuditEntry, opts: { notifyDelete: boolean; notifyAdd: boolean; notifyCustomer: boolean; notifySale: boolean; notifyForce: boolean; threshold: number }): NotificationType | null {
  if (e.entityType === "medicine" && e.action === "delete" && opts.notifyDelete) return "medicineDelete";
  if (e.entityType === "medicine" && e.action === "add" && opts.notifyAdd) return "medicineAdd";
  if (e.entityType === "customer" && e.action === "add" && opts.notifyCustomer) return "customerAdd";
  if (e.entityType === "sale" && e.action === "force-sale" && opts.notifyForce) return "forceSale";
  if (e.entityType === "sale" && e.action === "add" && opts.notifySale && (e.price ?? 0) > opts.threshold) return "sale";
  return null;
}