import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";
import { isMultiMode } from "@/lib/install";
import { isAdmin } from "@/store/session-store";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { money } from "@/lib/format";

/**
 * Item 9: notifies the logged-in admin, in Multi computer mode, about
 * events other users cause — configurable per condition in Settings.
 * Completely inactive for Single computer mode or a non-admin session.
 */
export function useAdminNotifications() {
  const settings = useProjectStore((s) => s.data?.settings);
  const sym = settings?.currencySymbol || "$";
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
        describeAndNotify(e, { notifyDelete, notifyAdd, notifyCustomer, notifySale, threshold, sym });
      }
      sinceRef.current = events[events.length - 1].timestamp;
    };

    const id = window.setInterval(() => void tick(), 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, notifyDelete, notifyAdd, notifyCustomer, notifySale, threshold]);
}

function describeAndNotify(
  e: AuditEntry,
  opts: { notifyDelete: boolean; notifyAdd: boolean; notifyCustomer: boolean; notifySale: boolean; threshold: number; sym: string },
) {
  const who = e.username || "Someone";

  if (e.entityType === "medicine" && e.action === "delete" && opts.notifyDelete) {
    toast.warning(`${who} deleted medicine "${e.medicineName ?? "?"}"`);
    return;
  }
  if (e.entityType === "medicine" && e.action === "add" && opts.notifyAdd) {
    toast.info(`${who} added medicine "${e.medicineName ?? "?"}"`);
    return;
  }
  if (e.entityType === "customer" && opts.notifyCustomer) {
    toast.info(`${who} added customer "${e.medicineName ?? "?"}"`);
    return;
  }
  if (e.entityType === "sale" && opts.notifySale) {
    const amount = e.price ?? 0;
    if (amount > opts.threshold) {
      toast.warning(`${who} made a sale of ${money(amount, opts.sym)}`);
    }
  }
}
