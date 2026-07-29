/**
 * Internal application storage + portable backup helpers.
 *
 * - Internal storage: Electron -> userData/medicore-data.bin, browser -> localStorage.
 *   This is what Ctrl+S / "Save" writes to. No file dialogs involved.
 * - Backups: a portable `.medicore` file the user chooses a folder for. It can be
 *   loaded on any other PC/install through Settings -> Load Data.
 */
import { pickSaveFile, pickOpenFile, writeToHandle } from "@/lib/project-io";

const LS_KEY = "medicore.internal.data";

function el(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).medicore ?? null;
}

function b64encode(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
function b64decode(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function readInternal(): Promise<Uint8Array | null> {
  const api = el();
  if (api?.store) {
    const b = await api.store.read();
    return b ? new Uint8Array(b) : null;
  }
  const raw = localStorage.getItem(LS_KEY);
  return raw ? b64decode(raw) : null;
}

export async function writeInternal(bytes: Uint8Array): Promise<void> {
  const api = el();
  if (api?.store) {
    await api.store.write(bytes);
    return;
  }
  localStorage.setItem(LS_KEY, b64encode(bytes));
}

export async function clearInternal(): Promise<void> {
  const api = el();
  if (api?.store) {
    await api.store.clear();
    return;
  }
  localStorage.removeItem(LS_KEY);
}

/** Ask the user for a backup folder. Returns null in browser / on cancel. */
export async function pickBackupFolder(): Promise<string | null> {
  const api = el();
  if (api?.backup) return (await api.backup.pickFolder()) ?? null;
  return null;
}

/**
 * Stable backup file name — reusing the same name means a new backup in the
 * same folder overwrites the previous one.
 */
export function backupFileName(pharmacyName: string) {
  const safe = (pharmacyName || "pharmacy").replace(/[^\w\-]+/g, "_");
  return `${safe}-backup.medicore`;
}


/**
 * Write a backup. When `folder` is given (Electron) the file is written silently
 * into that folder; otherwise the user picks a destination.
 */
export async function writeBackup(
  bytes: Uint8Array,
  pharmacyName: string,
  folder?: string | null,
): Promise<string | null> {
  const api = el();
  const fileName = backupFileName(pharmacyName);
  if (api?.backup && folder) {
    return await api.backup.write(folder, fileName, bytes);
  }
  const handle = await pickSaveFile(fileName.replace(/\.medicore$/, ""));
  if (!handle) return null;
  await writeToHandle(handle, bytes);
  return handle.path;
}

/** Let the user select a backup file and return its bytes. */
export async function readBackupFile(): Promise<Uint8Array | null> {
  const picked = await pickOpenFile();
  return picked ? picked.bytes : null;
}
