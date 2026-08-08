import { create } from "zustand";
import type { ProjectData } from "@/domain/schema";
import { encodeProject, decodeProject } from "@/lib/project-codec";
import { readInternal, writeInternal, clearInternal } from "@/lib/local-store";
import { reportDirty, writeRecovery, clearRecovery } from "@/lib/electron-bridge";
import { dbLoadProject, dbSaveProject, dbClearProject } from "@/lib/sqlite-bridge";
import { isClientMode } from "@/lib/install";
import { serverPullProject, serverPushProject, serverRevision } from "@/lib/server-api";

/** How many steps Ctrl+Z can walk back. */
const HISTORY_LIMIT = 40;

export interface MutateOptions {
  /** Set to false for actions that must never be undone (e.g. completing a sale). */
  history?: boolean;
}

interface ProjectState {
  data: ProjectData | null;
  dirty: boolean;
  lastSavedAt: number | null;
  isSaving: boolean;
  past: ProjectData[];
  future: ProjectData[];

  load(data: ProjectData): void;
  close(): void;
  mutate(fn: (draft: ProjectData) => void, options?: MutateOptions): void;
  undo(): boolean;
  redo(): boolean;
  markDirty(): void;
  /** Saves into internal application storage. Never opens a file dialog. */
  save(): Promise<boolean>;
  /** Serialised, portable bytes of the current project (for backups). */
  exportBytes(password?: string): Promise<Uint8Array | null>;
}


// Throttle recovery writes.
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRecovery() {
  if (recoveryTimer) return;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    const { data } = useProjectStore.getState();
    if (!data) return;
    await writeRecovery({
      id: data.meta.id,
      name: data.meta.name,
      data,
      savedAt: Date.now(),
    });
  }, 2000);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  data: null,
  dirty: false,
  lastSavedAt: null,
  isSaving: false,
  past: [],
  future: [],

  load(data) {
    set({ data, dirty: false, lastSavedAt: Date.now(), past: [], future: [] });
    reportDirty(false);
  },

  close() {
    set({ data: null, dirty: false, lastSavedAt: null, past: [], future: [] });
    reportDirty(false);
  },

  mutate(fn, options) {
    const { data, past } = get();
    if (!data) return;
    const next = structuredClone(data);
    fn(next);
    next.meta.updatedAt = new Date().toISOString();
    const keepHistory = options?.history !== false;
    set({
      data: next,
      dirty: true,
      past: keepHistory ? [...past, data].slice(-HISTORY_LIMIT) : past,
      future: keepHistory ? [] : get().future,
    });
    reportDirty(true);
    scheduleRecovery();
  },

  undo() {
    const { data, past, future } = get();
    if (!data || past.length === 0) return false;
    const previous = past[past.length - 1];
    set({
      data: previous,
      past: past.slice(0, -1),
      future: [...future, data].slice(-HISTORY_LIMIT),
      dirty: true,
    });
    reportDirty(true);
    scheduleRecovery();
    return true;
  },

  redo() {
    const { data, past, future } = get();
    if (!data || future.length === 0) return false;
    const nextState = future[future.length - 1];
    set({
      data: nextState,
      future: future.slice(0, -1),
      past: [...past, data].slice(-HISTORY_LIMIT),
      dirty: true,
    });
    reportDirty(true);
    scheduleRecovery();
    return true;
  },


  markDirty() { set({ dirty: true }); reportDirty(true); scheduleRecovery(); },

  async save() {
    const { data } = get();
    if (!data) return false;
    set({ isSaving: true });
    try {
      if (isClientMode()) {
        // Client mode never touches local SQLite or file storage — the
        // Server's database is the only source of truth. Push the whole
        // snapshot; SERVER_UNREACHABLE surfaces as a thrown Error, caught below.
        await serverPushProject(data);
        set({ dirty: false, lastSavedAt: Date.now() });
        reportDirty(false);
        await clearRecovery(data.meta.id);
        return true;
      }
      // Desktop (Electron + SQLite, Single or Server mode) writes to the
      // local database; the browser preview keeps using the existing
      // encrypted internal storage.
      const toDb = await dbSaveProject(data);
      if (!toDb) {
        const bytes = await encodeProject(data as unknown as Record<string, unknown>);
        await writeInternal(bytes);
      }
      set({ dirty: false, lastSavedAt: Date.now() });
      reportDirty(false);
      await clearRecovery(data.meta.id);
      return true;
    } catch (e) {
      console.error("save failed", e);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  async exportBytes(password?: string) {
    const { data } = get();
    if (!data) return null;
    return await encodeProject(data as unknown as Record<string, unknown>, password);
  },
}));

/** Read the project from internal application storage (startup path). */
export async function loadProjectFromInternal(): Promise<ProjectData | null> {
  const fromDb = await dbLoadProject();
  if (fromDb) {
    useProjectStore.getState().load(fromDb);
    return fromDb;
  }
  const bytes = await readInternal();
  if (!bytes) return null;
  try {
    const { payload } = await decodeProject(bytes);
    const data = payload as unknown as ProjectData;
    useProjectStore.getState().load(data);
    return data;
  } catch (e) {
    console.error("internal load failed", e);
    return null;
  }
}

/** Restore from a portable backup file's bytes and persist it internally. */
export async function restoreFromBytes(bytes: Uint8Array, password?: string): Promise<ProjectData> {
  const { payload } = await decodeProject(bytes, password);
  const data = payload as unknown as ProjectData;
  useProjectStore.getState().load(data);
  await useProjectStore.getState().save();
  return data;
}

export async function wipeInternalProject() {
  await dbClearProject();
  await clearInternal();
  useProjectStore.getState().close();
}

/**
 * Client-mode live sync (Part 5): polls the Server's /revision every few
 * seconds. When it's moved on from what we last saw — meaning a sale,
 * medicine edit, or purchase happened somewhere else — pull the fresh whole
 * snapshot and load it in. Skipped whenever there are unsaved local edits
 * (`dirty`) so an in-progress sale/edit here is never clobbered mid-flight;
 * the next poll after this device's own save() picks up cleanly instead.
 * Call once (e.g. from the app shell) after a Client is signed in; the
 * returned function stops polling.
 */
export function startClientLiveSync(intervalMs = 4000): () => void {
  let lastRevision: number | null = null;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      const { dirty, isSaving } = useProjectStore.getState();
      if (dirty || isSaving) return; // don't clobber in-flight local changes
      const { revision } = await serverRevision();
      if (lastRevision === null) { lastRevision = revision; return; }
      if (revision !== lastRevision) {
        const snapshot = await serverPullProject();
        if (!cancelled) {
          useProjectStore.getState().load(snapshot.data);
          lastRevision = snapshot.revision;
        }
      }
    } catch {
      // Server unreachable this tick — try again next interval, don't crash.
    }
  };

  const id = window.setInterval(tick, intervalMs);
  void tick(); // establish baseline immediately instead of waiting one interval
  return () => { cancelled = true; window.clearInterval(id); };
}
