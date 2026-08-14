import { useEffect } from "react";
import { useProjectStore } from "@/store/project-store";
import { isAdmin } from "@/store/session-store";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { useNotificationStore, type NotificationType } from "@/store/notification-store";

const NOTIFICATION_CURSOR_KEY = "medicore.admin-notification-audit-cursor";

function readCursor(): string | null {
  try { return localStorage.getItem(NOTIFICATION_CURSOR_KEY); } catch { return null; }
}

function writeCursor(iso: string) {
  try { localStorage.setItem(NOTIFICATION_CURSOR_KEY, iso); } catch {}
}

/** Admin notification polling works in both Single and Multi computer modes.
 * The cursor is persisted across logout so events created while the admin is
 * away are delivered when the admin signs back in. Only this hook consumes the
 * audit stream, preventing duplicate notifications from multiple pollers. */
export function useAdminNotifications() {
  const settings = useProjectStore((s) => s.data?.settings);
  const addNotification = useNotificationStore((s) => s.add);
  const active = isAdmin();
  const notifyDelete = settings?.notifyOnDeleteMedicine ?? false;
  const notifyAdd = settings?.notifyOnAddMedicine ?? false;
  const notifyCustomer = settings?.notifyOnAddCustomer ?? false;
  const notifySale = settings?.notifyOnLargeSale ?? false;
  const notifyForce = settings?.notifyOnForceSale ?? true;
  const threshold = settings?.largeSaleThreshold ?? 0;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: number | null = null;
    let cursor = readCursor();
    if (!cursor) cursor = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const tick = async () => {
      if (cancelled || !cursor) return;
      try {
        // Include a tiny overlap at the timestamp boundary. The notification
        // store deduplicates by audit event id, so this is safe and prevents
        // same-millisecond audit events from being skipped.
        const parsed = Date.parse(cursor);
        const since = new Date(Math.max(0, parsed - 1)).toISOString();
        const events = (await getRecentEvents(since)) as AuditEntry[];
        if (cancelled) return;

        let newest = cursor;
        for (const e of events) {
          if (e.timestamp > newest) newest = e.timestamp;
          const type = matchType(e, { notifyDelete, notifyAdd, notifyCustomer, notifySale, notifyForce, threshold });
          if (type) {
            addNotification({
              id: `audit:${e.id}`,
              type,
              username: e.username || "Someone",
              timestamp: e.timestamp,
              entityId: e.entityId,
              medicineName: e.medicineName,
              quantity: e.quantity,
              price: e.price,
            });
          }
        }

        // Advance only to an event actually observed. Never advance to the
        // current wall clock, otherwise an event written during an in-flight
        // poll can be skipped permanently.
        if (events.length > 0) {
          cursor = newest;
          writeCursor(cursor);
        }
      } catch (e) {
        console.error("[notifications] audit sync failed", e);
      }
      if (!cancelled) timer = window.setTimeout(tick, 2000);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
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
