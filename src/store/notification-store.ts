import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationType = "sale" | "medicineDelete" | "medicineAdd" | "customerAdd";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  username: string;
  timestamp: string;
  read: boolean;
  /** For "sale" — the actual Sale.id, so the detail view can look up full line items. */
  entityId: string;
  medicineName?: string;
  quantity?: number;
  /** Sale total for "sale", unit price for medicine events. */
  price?: number;
}

interface NotificationState {
  items: NotificationItem[];
  add: (item: Omit<NotificationItem, "read">) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/** Persisted per-computer (localStorage) — this is a personal admin inbox
 * on whichever machine they're actively signed into, not synced data. */
export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          if (s.items.some((x) => x.id === item.id)) return s; // no duplicates
          const next = [{ ...item, read: false }, ...s.items];
          return { items: next.slice(0, 200) }; // cap so this never grows unbounded
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      clearAll: () => set({ items: [] }),
      markRead: (id) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, read: true } : x)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((x) => ({ ...x, read: true })) })),
    }),
    { name: "medicore.admin-notifications" },
  ),
);
