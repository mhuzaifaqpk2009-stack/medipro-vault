import { useEffect, useRef } from "react";
import { useProjectStore } from "@/store/project-store";
import { isMultiMode } from "@/lib/install";
import { isAdmin } from "@/store/session-store";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { useNotificationStore, type NotificationType } from "@/store/notification-store";

/**
 * Item 9: notifies the logged-in admin, in Multi computer mode, about
 * events other users cause — configurable per condition in Settings.
 * Completely inactive for Single computer mode or a non-admin session.
 * Matching events land in the persisted notification store, shown via
 * the bell icon in the topbar.
 */
export function useAdminNotifications() {
  const settings = useProjectStore((s) => s.data?.settings);
  const addNotification = useNotificationStore((s) => s.add);
  const sinceRef = useRef<string | null>(null);

  const active = isMultiMode() && isAdmin();

  const notifyDelete = settings?.notifyOnDeleteMedicine ?? false;
  const notifyAdd = settings?.notifyOnAddMedicine ?? false;
  const notifyCustomer = settings?.notifyOnAddCustomer ?? false;
  const notifySale = settings?.notifyOnLargeSale ?? false;
  const threshold = settings?.largeSaleThreshold ?? 0;

  useEffect(() => {
    if (!active) return;
    // Only notify about things that happen from now on, not old history.
    sinceRef.current = new Date().toISOString();

    const tick = async () => {
      if (!sinceRef.current) return;
      const events = await getRecentEvents(sinceRef.current);
      if (events.length === 0) return;

      for (const e of events as AuditEntry[]) {
        const type = matchType(e, { notifyDelete, notifyAdd, notifyCustomer, notifySale, threshold });
        if (type) {
          addNotification({
            id: e.id, type, username: e.username || "Someone", timestamp: e.timestamp,
            entityId: e.entityId, medicineName: e.medicineName, quantity: e.quantity, price: e.price,
          });
        }
      }
      sinceRef.current = events[events.length - 1].timestamp;
    };

    const id = window.setInterval(() => void tick(), 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, notifyDelete, notifyAdd, notifyCustomer, notifySale, threshold]);
}

function matchType(
  e: AuditEntry,
  opts: { notifyDelete: boolean; notifyAdd: boolean; notifyCustomer: boolean; notifySale: boolean; threshold: number },
): NotificationType | null {
  if (e.entityType === "medicine" && e.action === "delete" && opts.notifyDelete) return "medicineDelete";
  if (e.entityType === "medicine" && e.action === "add" && opts.notifyAdd) return "medicineAdd";
  if (e.entityType === "customer" && opts.notifyCustomer) return "customerAdd";
  if (e.entityType === "sale" && opts.notifySale && (e.price ?? 0) > opts.threshold) return "sale";
  return null;
}
