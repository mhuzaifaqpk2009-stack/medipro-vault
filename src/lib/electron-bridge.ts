/**
 * Typed helpers around window.medicore. All calls are safe to make in the
 * browser: they resolve to sensible no-ops when not running under Electron.
 */
export interface RecoveryEntry {
  id: string;
  name: string;
  fsPath?: string;
  savedAt: number;
}
export interface RecoverySnapshot {
  id: string;
  name: string;
  fsPath?: string;
  data: unknown; // ProjectData; kept as unknown to avoid a circular import
  savedAt: number;
}

type UnsavedChoice = "save" | "discard" | "cancel";

interface MedicoreAPI {
  dialog: {
    showUnsavedDialog: (o?: { message?: string; detail?: string; title?: string }) => Promise<UnsavedChoice>;
  };
  app: {
    setDirty: (v: boolean) => Promise<boolean>;
    saveCompleted: (ok: boolean) => Promise<boolean>;
    onSaveAndQuit: (cb: () => void) => () => void;
  };
  recovery: {
    write: (id: string, snapshot: string) => Promise<boolean>;
    clear: (id: string) => Promise<boolean>;
    list: () => Promise<RecoveryEntry[]>;
    read: (id: string) => Promise<RecoverySnapshot>;
  };
}

export function bridge(): MedicoreAPI | null {
  if (typeof window === "undefined") return null;
  return (window as any).medicore ?? null;
}

export const inElectron = () => bridge() !== null;

export async function reportDirty(v: boolean) {
  try { await bridge()?.app.setDirty(v); } catch {}
}

export async function writeRecovery(snapshot: RecoverySnapshot) {
  try { await bridge()?.recovery.write(snapshot.id, JSON.stringify(snapshot)); } catch {}
}

export async function clearRecovery(id: string) {
  try { await bridge()?.recovery.clear(id); } catch {}
}

export async function listRecovery(): Promise<RecoveryEntry[]> {
  try { return (await bridge()?.recovery.list()) ?? []; } catch { return []; }
}

export async function readRecovery(id: string): Promise<RecoverySnapshot | null> {
  try { return (await bridge()?.recovery.read(id)) ?? null; } catch { return null; }
}
