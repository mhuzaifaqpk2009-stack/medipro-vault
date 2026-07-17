import { create } from "zustand";
import type { ProjectData } from "@/domain/schema";
import type { ProjectFileHandle } from "@/lib/project-io";
import { encodeProject, decodeProject } from "@/lib/project-codec";
import { writeToHandle, pickSaveFile, isPersistentHandle } from "@/lib/project-io";
import { upsertRecent } from "@/lib/recents";

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

export const useProjectStore = create<ProjectState>((set, get) => ({
  data: null,
  handle: null,
  password: undefined,
  dirty: false,
  lastSavedAt: null,
  isSaving: false,

  load(data, handle, password) {
    set({ data, handle, password, dirty: false, lastSavedAt: Date.now() });
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
  },

  mutate(fn) {
    const { data } = get();
    if (!data) return;
    // Simple structural copy — modules only mutate small sub-branches.
    const next = structuredClone(data);
    fn(next);
    next.meta.updatedAt = new Date().toISOString();
    set({ data: next, dirty: true });
  },

  markDirty() {
    set({ dirty: true });
  },

  async save() {
    const { data, handle, password } = get();
    if (!data) return false;
    if (!handle || !isPersistentHandle(handle)) return get().saveAs();
    set({ isSaving: true });
    try {
      const bytes = await encodeProject(data as unknown as Record<string, unknown>, password);
      await writeToHandle(handle, bytes);
      set({ dirty: false, lastSavedAt: Date.now() });
      upsertRecent({
        name: data.meta.name,
        path: handle.path,
        fsPath: handle.fsPath,
        encrypted: !!password,
      });
      return true;
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
      upsertRecent({
        name: data.meta.name,
        path: handle.path,
        fsPath: handle.fsPath,
        encrypted: !!password,
      });
      return true;
    } finally {
      set({ isSaving: false });
    }
  },
}));

// Utility to load a project from raw bytes into the store.
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
