import { create } from "zustand";
import type { ProjectData } from "@/domain/schema";
import type { ProjectFileHandle } from "@/lib/project-io";
import { encodeProject, decodeProject } from "@/lib/project-codec";
import { writeToHandle, pickSaveFile, isPersistentHandle } from "@/lib/project-io";
import { upsertRecent } from "@/lib/recents";
import { reportDirty, writeRecovery, clearRecovery } from "@/lib/electron-bridge";

interface ProjectState {
  data: ProjectData | null;
  handle: ProjectFileHandle | null;
  password?: string;
  dirty: boolean;
  lastSavedAt: number | null;
  isSaving: boolean;

  load(data: ProjectData, handle: ProjectFileHandle | null, password?: string): void;
  close(): void;
  mutate(fn: (draft: ProjectData) => void): void;
  markDirty(): void;
  save(): Promise<boolean>;
  saveAs(): Promise<boolean>;
}

// Throttle recovery writes.
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRecovery() {
  if (recoveryTimer) return;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    const { data, handle, password } = useProjectStore.getState();
    if (!data || password) return; // don't write plaintext recovery for encrypted files
    await writeRecovery({
      id: data.meta.id,
      name: data.meta.name,
      fsPath: handle?.fsPath,
      data,
      savedAt: Date.now(),
    });
  }, 2000);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  data: null,
  handle: null,
  password: undefined,
  dirty: false,
  lastSavedAt: null,
  isSaving: false,

  load(data, handle, password) {
    set({ data, handle, password, dirty: false, lastSavedAt: Date.now() });
    reportDirty(false);
    if (handle) {
      upsertRecent({
        name: data.meta.name,
        path: handle.path,
        fsPath: handle.fsPath,
        encrypted: !!password,
      });
    }
  },

  close() {
    set({ data: null, handle: null, password: undefined, dirty: false, lastSavedAt: null });
    reportDirty(false);
  },

  mutate(fn) {
    const { data } = get();
    if (!data) return;
    const next = structuredClone(data);
    fn(next);
    next.meta.updatedAt = new Date().toISOString();
    set({ data: next, dirty: true });
    reportDirty(true);
    scheduleRecovery();
  },

  markDirty() { set({ dirty: true }); reportDirty(true); scheduleRecovery(); },

  async save() {
    const { data, handle, password } = get();
    if (!data) return false;
    if (!handle || !isPersistentHandle(handle)) return get().saveAs();
    set({ isSaving: true });
    try {
      const bytes = await encodeProject(data as unknown as Record<string, unknown>, password);
      await writeToHandle(handle, bytes);
      set({ dirty: false, lastSavedAt: Date.now() });
      reportDirty(false);
      upsertRecent({
        name: data.meta.name, path: handle.path,
        fsPath: handle.fsPath, encrypted: !!password,
      });
      await clearRecovery(data.meta.id);
      return true;
    } catch (e) {
      console.error("save failed", e);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  async saveAs() {
    const { data, password } = get();
    if (!data) return false;
    const handle = await pickSaveFile(data.meta.name);
    if (!handle) return false;
    set({ handle, isSaving: true });
    try {
      const bytes = await encodeProject(data as unknown as Record<string, unknown>, password);
      await writeToHandle(handle, bytes);
      set({ dirty: false, lastSavedAt: Date.now() });
      reportDirty(false);
      upsertRecent({
        name: data.meta.name, path: handle.path,
        fsPath: handle.fsPath, encrypted: !!password,
      });
      await clearRecovery(data.meta.id);
      return true;
    } catch (e) {
      console.error("saveAs failed", e);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
}));

export async function openProjectFromBytes(
  bytes: Uint8Array,
  handle: ProjectFileHandle | null,
  password?: string,
): Promise<ProjectData> {
  const { payload } = await decodeProject(bytes, password);
  const data = payload as unknown as ProjectData;
  useProjectStore.getState().load(data, handle, password);
  return data;
}
