/**
 * Client-side access to the pharmacy Server (multi-computer mode).
 *
 * Server sessions are held only in memory on this client. Sensitive requests
 * carry the session token in a dedicated header; project writes also carry
 * the last server revision to prevent stale whole-snapshot overwrites.
 */
import { readInstall } from "@/lib/install";
import type { StoredUser } from "@/lib/users";
import type { ProjectData } from "@/domain/schema";

export const DEFAULT_SERVER_PORT = 4000;
let sessionId: string | null = null;
let knownRevision: number | null = null;

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
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (sessionId) headers["x-hpms-session"] = sessionId;
  if (path === "/project" && init?.method === "PUT" && knownRevision !== null) {
    headers["x-hpms-revision"] = String(knownRevision);
  }
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, headers });
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

export async function pingServer(host: string, port = DEFAULT_SERVER_PORT) {
  const base = `http://${host.trim()}:${port}`;
  return req<{ ok: true; pharmacyName?: string }>("/health", { method: "GET" }, base);
}

export async function serverLogin(username: string, password: string) {
  const result = await req<{ ok: true; user: StoredUser; sessionId: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  sessionId = result.sessionId;
  knownRevision = null;
  return result;
}

export async function serverLogout(_sessionId?: string) {
  try {
    await req("/logout", { method: "POST", body: JSON.stringify({ sessionId }) });
  } catch {
    /* signing out locally must always succeed */
  } finally {
    sessionId = null;
    knownRevision = null;
  }
}

export async function serverPullProject() {
  const result = await req<{ ok: true; data: ProjectData; revision: number }>("/project", { method: "GET" });
  knownRevision = result.revision;
  return result;
}

export async function serverPushProject(data: ProjectData) {
  const result = await req<{ ok: true; revision: number }>("/project", {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
  knownRevision = result.revision;
  return result;
}

export async function serverRevision() {
  const result = await req<{ ok: true; revision: number }>("/revision", { method: "GET" });
  knownRevision = result.revision;
  return result;
}

export async function serverLogAudit(entry: unknown) {
  return req<{ ok: true }>("/audit", { method: "POST", body: JSON.stringify(entry) });
}

export async function serverGetAuditLog(entityType: string, entityId: string) {
  return req<{ ok: true; entries: unknown[] }>(
    `/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    { method: "GET" },
  );
}

export async function serverGetRecentEvents(sinceIso: string) {
  return req<{ ok: true; entries: unknown[] }>(
    `/audit/recent?since=${encodeURIComponent(sinceIso)}`,
    { method: "GET" },
  );
}
