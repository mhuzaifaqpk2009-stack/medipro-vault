/**
 * Filesystem I/O abstraction.
 * - In Electron (window.medicore) uses native dialogs + fs.
 * - In the browser uses File System Access API where available, otherwise
 *   falls back to download / <input type=file> for open.
 *
 * The returned FileHandle is opaque and passed back for save / save-as.
 */

export interface ProjectFileHandle {
  kind: "fsa" | "electron" | "download";
  name: string;
  path: string; // display path (in browser: file name only)
  // fsa
  handle?: FileSystemFileHandle;
  // electron
  fsPath?: string;
}

const FILE_EXT = "medicore";
const MIME = "application/octet-stream";

function hasFSA() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

function inElectron() {
  return typeof window !== "undefined" && Boolean((window as any).medicore);
}

export async function pickSaveFile(suggestedName: string): Promise<ProjectFileHandle | null> {
  const safeName = suggestedName.replace(/[^\w\-]+/g, "_") || "pharmacy";
  const fileName = `${safeName}.${FILE_EXT}`;

  if (inElectron()) {
    const res = await (window as any).medicore.dialog.showSaveDialog({
      defaultPath: fileName,
      filters: [{ name: "MediCore Project", extensions: [FILE_EXT] }],
    });
    if (!res || res.canceled || !res.filePath) return null;
    return { kind: "electron", name: baseName(res.filePath), path: res.filePath, fsPath: res.filePath };
  }

  if (hasFSA()) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "MediCore Project",
            accept: { [MIME]: [`.${FILE_EXT}`] },
          },
        ],
      });
      return { kind: "fsa", name: handle.name, path: handle.name, handle };
    } catch (e: any) {
      if (e?.name === "AbortError") return null;
      throw e;
    }
  }

  // Download fallback: caller writes bytes -> triggers download later.
  return { kind: "download", name: fileName, path: fileName };
}

export async function pickOpenFile(): Promise<
  { handle: ProjectFileHandle; bytes: Uint8Array } | null
> {
  if (inElectron()) {
    const res = await (window as any).medicore.dialog.showOpenDialog({
      filters: [{ name: "MediCore Project", extensions: [FILE_EXT] }],
      properties: ["openFile"],
    });
    if (!res || res.canceled || !res.filePaths?.[0]) return null;
    const fsPath = res.filePaths[0];
    const bytes: Uint8Array = await (window as any).medicore.project.readFile(fsPath);
    return {
      handle: { kind: "electron", name: baseName(fsPath), path: fsPath, fsPath },
      bytes,
    };
  }

  if (hasFSA()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "MediCore Project",
            accept: { [MIME]: [`.${FILE_EXT}`] },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { handle: { kind: "fsa", name: handle.name, path: handle.name, handle }, bytes };
    } catch (e: any) {
      if (e?.name === "AbortError") return null;
      throw e;
    }
  }

  // Fallback: hidden input
  return openViaInput();
}

function openViaInput(): Promise<{ handle: ProjectFileHandle; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `.${FILE_EXT}`;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const bytes = new Uint8Array(await f.arrayBuffer());
      resolve({
        handle: { kind: "download", name: f.name, path: f.name },
        bytes,
      });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function writeToHandle(
  handle: ProjectFileHandle,
  bytes: Uint8Array,
): Promise<void> {
  if (handle.kind === "electron" && handle.fsPath) {
    await (window as any).medicore.project.writeFile(handle.fsPath, bytes);
    return;
  }
  if (handle.kind === "fsa" && handle.handle) {
    const writable = await handle.handle.createWritable();
    await writable.write(bytes as unknown as BufferSource);
    await writable.close();
    return;
  }
  // download fallback
  const blob = new Blob([new Uint8Array(bytes)], { type: MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = handle.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function baseName(p: string) {
  return p.split(/[\\/]/).pop() || p;
}

export function isPersistentHandle(h: ProjectFileHandle | null): boolean {
  if (!h) return false;
  return h.kind === "electron" || h.kind === "fsa";
}
