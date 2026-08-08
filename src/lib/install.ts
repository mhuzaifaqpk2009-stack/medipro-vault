/**
 * First-run installation record kept in localStorage.
 * Holds: users (with permissions), file-encryption password, last file path.
 */

import { defaultPermissions, type StoredUser, type UserRole } from "./users";
import { configureServer, syncServerUsers } from "./server-bridge";

const KEY = "medicore.install";
const LEGACY_SINGLE_USER_NAME = "admin";

/** How this computer participates: alone, as the shared server, or as a client. */
export type DeployMode = "single" | "server" | "client";

export interface InstallRecord {
  setupDone: true;
  /** Missing = legacy install, treated as "single". */
  deployMode?: DeployMode;
  /** Server LAN address a client talks to, e.g. "192.168.1.20". */
  serverHost?: string;
  serverPort?: number;
  /** Admin-chosen Reset Setup password (PBKDF2). No hardcoded default exists. */
  resetSaltHex?: string;
  resetHashHex?: string;
  pharmacyName: string;
  address: string;
  users: StoredUser[];
  /** Raw file-encryption password. Local desktop app; kept only in localStorage. */
  filePassword?: string;
  /** When false, the app opens without a sign-in prompt. */
  requireLogin?: boolean;
  lastFsPath?: string;
  lastPath?: string;
  // Legacy fields (kept for migration): saltHex/hashHex of single admin
  saltHex?: string;
  hashHex?: string;
}

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" },
    material, 256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return { saltHex: toHex(salt), hashHex: toHex(bits) };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string) {
  const bits = await derive(password, fromHex(saltHex));
  return toHex(bits) === hashHex;
}

export function readInstall(): InstallRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as InstallRecord;
    // Migrate legacy single-user record: promote to admin user.
    if ((!rec.users || rec.users.length === 0) && rec.saltHex && rec.hashHex) {
      const admin: StoredUser = {
        id: crypto.randomUUID(),
        username: LEGACY_SINGLE_USER_NAME,
        role: "admin",
        saltHex: rec.saltHex,
        hashHex: rec.hashHex,
        permissions: defaultPermissions("admin"),
      };
      rec.users = [admin];
      writeInstall(rec);
    }
    return rec;
  } catch {
    return null;
  }
}

export function writeInstall(rec: InstallRecord) {
  localStorage.setItem(KEY, JSON.stringify(rec));
  // Best-effort, fire-and-forget: keeps the Electron main process's LAN
  // server (if this is the Server computer) in sync with mode + users on
  // every write — mode switches, admin setup, and every user create/edit/
  // delete all flow through here already, so one hook point covers all of it.
  const mode = rec.deployMode ?? "single";
  void configureServer(mode, rec.serverPort ?? 4000, rec.pharmacyName);
  if (mode === "server") void syncServerUsers(rec.users ?? []);
}
export function updateInstall(patch: Partial<InstallRecord>) {
  const cur = readInstall();
  if (!cur) return;
  writeInstall({ ...cur, ...patch });
}
export function deployMode(): DeployMode {
  return readInstall()?.deployMode ?? "single";
}
export function isClientMode() { return deployMode() === "client"; }
export function isMultiMode() { return deployMode() !== "single"; }

/** Store the admin's Reset Setup password. */
export async function setResetPassword(password: string) {
  const { saltHex, hashHex } = await hashPassword(password);
  updateInstall({ resetSaltHex: saltHex, resetHashHex: hashHex });
  return { saltHex, hashHex };
}

/** Verify the Reset Setup password. Returns false when none was ever set. */
export async function verifyResetPassword(password: string) {
  const rec = readInstall();
  if (!rec?.resetSaltHex || !rec?.resetHashHex) return false;
  return verifyPassword(password, rec.resetSaltHex, rec.resetHashHex);
}

export function clearInstall() {
  localStorage.removeItem(KEY);
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  permissions?: Partial<import("./users").UserPermissions>;
}): Promise<StoredUser> {
  const { saltHex, hashHex } = await hashPassword(input.password);
  return {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    role: input.role,
    saltHex, hashHex,
    permissions: { ...defaultPermissions(input.role), ...(input.permissions ?? {}) },
  };
}

export async function findUserByLogin(
  username: string,
  password: string,
): Promise<StoredUser | null> {
  const rec = readInstall();
  if (!rec) return null;
  const u = rec.users?.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
  if (!u) return null;
  const ok = await verifyPassword(password, u.saltHex, u.hashHex);
  return ok ? u : null;
}

export function upsertUser(u: StoredUser) {
  const rec = readInstall();
  if (!rec) return;
  const users = rec.users ?? [];
  const i = users.findIndex((x) => x.id === u.id);
  if (i >= 0) users[i] = u;
  else users.push(u);
  writeInstall({ ...rec, users });
}

export function removeUser(id: string) {
  const rec = readInstall();
  if (!rec) return;
  const users = (rec.users ?? []).filter((x) => x.id !== id);
  // Never remove the last admin.
  if (!users.some((x) => x.role === "admin")) return;
  writeInstall({ ...rec, users });
}
