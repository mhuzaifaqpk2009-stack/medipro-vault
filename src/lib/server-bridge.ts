/**
 * Client-side bridge to the Electron main process's LAN server controls.
 * Only meaningful on the Server computer; everywhere else (Single computer,
 * Client, or the plain browser preview) every call here safely no-ops since
 * `window.medicoreServer` won't exist.
 */
import type { StoredUser } from "./users";
import type { DeployMode } from "./install";

export interface DiscoveredServer {
  host: string;
  port: number;
  pharmacyName: string;
  connection: string;
}

interface MedicoreServerAPI {
  configure: (opts: { deployMode: DeployMode; port: number; pharmacyName: string }) => Promise<boolean>;
  syncUsers: (users: StoredUser[]) => Promise<boolean>;
  status: () => Promise<{ running: boolean; port: number | null }>;
  discover?: (timeoutMs?: number) => Promise<DiscoveredServer[]>;
  onRevisionBumped: (cb: (revision: number) => void) => () => void;
}

function api(): MedicoreServerAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { medicoreServer?: MedicoreServerAPI }).medicoreServer ?? null;
}

export async function configureServer(deployMode: DeployMode, port: number, pharmacyName: string) {
  try {
    return (await api()?.configure({ deployMode, port, pharmacyName })) ?? false;
  } catch {
    return false;
  }
}

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

export async function discoverLanServers(timeoutMs = 2500): Promise<DiscoveredServer[]> {
  try {
    return (await api()?.discover?.(timeoutMs)) ?? [];
  } catch {
    return [];
  }
}

export function onServerRevisionBumped(cb: (revision: number) => void): () => void {
  const a = api();
  if (!a) return () => {};
  return a.onRevisionBumped(cb);
}
