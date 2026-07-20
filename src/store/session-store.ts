import { create } from "zustand";
import type { StoredUser } from "@/lib/users";

interface SessionState {
  user: StoredUser | null;
  setUser(u: StoredUser | null): void;
  clear(): void;
}

const KEY = "medicore.session";

function readCached(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch { return null; }
}

export const useSession = create<SessionState>((set) => ({
  user: readCached(),
  setUser(u) {
    set({ user: u });
    try {
      if (u) sessionStorage.setItem(KEY, JSON.stringify(u));
      else sessionStorage.removeItem(KEY);
    } catch { /* ignore */ }
  },
  clear() {
    set({ user: null });
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  },
}));

export function currentUser(): StoredUser | null {
  return useSession.getState().user;
}

export function isAdmin(): boolean {
  return useSession.getState().user?.role === "admin";
}
