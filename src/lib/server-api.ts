/**
 * Client-side access to the pharmacy Server (multi-computer mode).
 *
 * In Server mode the Electron main process runs a small HTTP API (default
 * port 4000). Clients talk to it over the LAN using these helpers, keeping the
 * same shapes the rest of the app already uses.
 */
import { readInstall } from "@/lib/install";
import type { StoredUser } from "@/lib/users";
import type { ProjectData } from "@/domain/schema";

export const DEFAULT_SERVER_PORT = 4000;

export function serverBaseUrl(host?: string, port?: number): string | null {
  const rec = readInstall();
  const h = (host ?? rec?.serverHost ?? "").trim();
  if (!h) return null;
  const p = port ?? rec?.serverPort ?? DEFAULT_SERVER_PORT;
  return `http://${h}:${p}`;
}

export const SERVER_UNREACHABLE =
  "Can't reach server — check the IP and make sure the server computer is running.";

async function req<T>(path: string, init?: RequestInit, base?: string): Promise<T> {
  const url = (base ?? serverBaseUrl()) + path;
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.error || `Server error ${res.status}`);
    return body as T;
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message === "Failed to fetch") {
      throw new Error(SERVER_UNREACHABLE);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Connection test used by the client setup screen. */
export async function pingServer(host: string, port = DEFAULT_SERVER_PORT) {
  const base = `http://${host.trim()}:${port}`;
  return req<{ ok: true; pharmacyName?: string }>("/health", { method: "GET" }, base);
}

export async function serverLogin(username: string, password: string) {
  return req<{ ok: true; user: StoredUser; sessionId: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function serverLogout(sessionId: string) {
  try {
    await req("/logout", { method: "POST", body: JSON.stringify({ sessionId }) });
  } catch { /* signing out locally must always succeed */ }
}

/** Full snapshot pull — used for the client's initial load and polling sync. */
export async function serverPullProject() {
  return req<{ ok: true; data: ProjectData; revision: number }>("/project", { method: "GET" });
}

/** Push the whole project after a local mutation on a client. */
export async function serverPushProject(data: ProjectData) {
  return req<{ ok: true; revision: number }>("/project", {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

export async function serverRevision() {
  return req<{ ok: true; revision: number }>("/revision", { method: "GET" });
}

/** Part 6: audit log — a Client logs a medicine add/edit event directly to
 * the Server in real time, separate from the coarser whole-project sync. */
export async function serverLogAudit(entry: unknown) {
  return req<{ ok: true }>("/audit", { method: "POST", body: JSON.stringify(entry) });
}

export async function serverGetAuditLog(entityType: string, entityId: string) {
  return req<{ ok: true; entries: unknown[] }>(
    `/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    { method: "GET" },
  );
}
