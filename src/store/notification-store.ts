import { create } from "zustand";
import { persist } from "zustand/middleware";
export type NotificationType = "sale" | "medicineDelete" | "medicineAdd" | "customerAdd" | "forceSale";
export interface NotificationItem { id: string; type: NotificationType; username: string; timestamp: string; read: boolean; entityId: string; medicineName?: string; quantity?: number; price?: number; }
interface NotificationState { items: NotificationItem[]; add: (item: Omit<NotificationItem, "read">) => void; remove: (id: string) => void; clearAll: () => void; markRead: (id: string) => void; markAllRead: () => void; }
export const useNotificationStore = create<NotificationState>()(persist((set) => ({
  items: [],
  add: (item) => set((s) => s.items.some((x) => x.id === item.id) ? s : { items: [{ ...item, read: false }, ...s.items].slice(0, 200) }),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  clearAll: () => set({ items: [] }),
  markRead: (id) => set((s) => ({ items: s.items.map((x) => x.id === id ? { ...x, read: true } : x) })),
  markAllRead: () => set((s) => ({ items: s.items.map((x) => ({ ...x, read: true })) })),
}), { name: "medicore.admin-notifications" }));