/**
 * Recent projects registry (localStorage-backed for browser; Electron mirrors
 * this to userData/recents.json via the same key on the renderer).
 */
export interface RecentProject {
  id: string;
  name: string;
  path: string; // display path
  fsPath?: string; // Electron only
  encrypted: boolean;
  lastOpened: number;
}

const KEY = "medicore.recents";
const MAX = 12;

export function readRecents(): RecentProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as RecentProject[]).sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export function writeRecents(list: RecentProject[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function upsertRecent(p: Omit<RecentProject, "lastOpened" | "id"> & { id?: string }) {
  const list = readRecents();
  const id = p.id ?? p.fsPath ?? p.path;
  const filtered = list.filter((r) => r.id !== id);
  filtered.unshift({ ...p, id, lastOpened: Date.now() });
  writeRecents(filtered);
}

export function removeRecent(id: string) {
  writeRecents(readRecents().filter((r) => r.id !== id));
}

export function renameRecent(id: string, name: string) {
  const list = readRecents().map((r) => (r.id === id ? { ...r, name } : r));
  writeRecents(list);
}
