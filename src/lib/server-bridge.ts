/**
 * Client-side bridge to the Electron main process's LAN server controls.
 * Only meaningful on the Server computer; everywhere else (Single computer,
 * Client, or the plain browser preview) every call here safely no-ops since
 * `window.medicoreServer` won't exist.
 */
import type { StoredUser } from "./users";
import type { DeployMode } from "./install";

interface MedicoreServerAPI {
  configure: (opts: { deployMode: DeployMode; port: number; pharmacyName: string }) => Promise<boolean>;
  syncUsers: (users: StoredUser[]) => Promise<boolean>;
  status: () => Promise<{ running: boolean; port: number | null }>;
  onRevisionBumped: (cb: (revision: number) => void) => () => void;
}

function api(): MedicoreServerAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { medicoreServer?: MedicoreServerAPI }).medicoreServer ?? null;
}

/** Tells the main process to start (Server) or stop (Single/Client) the LAN
 * HTTP listener. Safe to call often — starting an already-running server is
 * a no-op on the main-process side. */
export async function configureServer(deployMode: DeployMode, port: number, pharmacyName: string) {
  try {
    return (await api()?.configure({ deployMode, port, pharmacyName })) ?? false;
  } catch {
    return false;
  }
}

/** Mirrors the Server's user list into the main process so /login can
 * authenticate Clients without touching renderer localStorage directly. */
export async function syncServerUsers(users: StoredUser[]) {
  try {
    return (await api()?.syncUsers(users)) ?? false;
  } catch {
    return false;
  }
}

export async function serverRuntimeStatus() {
  try {
    return (await api()?.status()) ?? { running: false, port: null };
  } catch {
    return { running: false, port: null };
  }
}

/** Fires when a Client's push changed the data while this Server window is
 * open, so the Server's own screen can live-update too. */
export function onServerRevisionBumped(cb: (revision: number) => void): () => void {
  const a = api();
  if (!a) return () => {};
  return a.onRevisionBumped(cb);
}
