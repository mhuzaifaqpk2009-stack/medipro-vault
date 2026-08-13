/** First-run installation record. Password secrets are OS-encrypted before localStorage persistence. */
import { defaultPermissions, type StoredUser, type UserRole } from "./users";
import { configureServer, syncServerUsers } from "./server-bridge";
import { decryptSecret, secureSecret, secretStorageAvailable } from "./electron-bridge";
const KEY = "medicore.install";
const LEGACY_SINGLE_USER_NAME = "admin";
const SECRET_PREFIX = "hpms-safe-v1:";
export type DeployMode = "single" | "server" | "client";
export interface InstallRecord {
  setupDone: true; deployMode?: DeployMode; serverHost?: string; serverPort?: number; resetSaltHex?: string; resetHashHex?: string;
  pharmacyName: string; address: string; users: StoredUser[]; filePassword?: string; requireLogin?: boolean; lastFsPath?: string; lastPath?: string; saltHex?: string; hashHex?: string;
}
const enc = new TextEncoder();
function toHex(buf: ArrayBuffer | Uint8Array) { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); }
function fromHex(hex: string) { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out; }
async function derive(password: string, salt: Uint8Array) { const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" }, material, 256); return new Uint8Array(bits); }
export async function hashPassword(password: string) { const salt = crypto.getRandomValues(new Uint8Array(16)); const bits = await derive(password, salt); return { saltHex: toHex(salt), hashHex: toHex(bits) }; }
export async function verifyPassword(password: string, saltHex: string, hashHex: string) { const bits = await derive(password, fromHex(saltHex)); return toHex(bits) === hashHex; }
function decryptStoredFilePassword(rec: InstallRecord): InstallRecord {
  if (!rec.filePassword) return rec;
  if (rec.filePassword.startsWith(SECRET_PREFIX)) {
    const plain = decryptSecret(rec.filePassword.slice(SECRET_PREFIX.length));
    return plain ? { ...rec, filePassword: plain } : { ...rec, filePassword: undefined };
  }
  // One-time migration of legacy plaintext localStorage. The plaintext is
  // removed immediately when OS-backed encryption is available.
  if (secretStorageAvailable()) {
    const encrypted = secureSecret(rec.filePassword);
    if (encrypted) {
      const safe = { ...rec, filePassword: `${SECRET_PREFIX}${encrypted}` };
      try { localStorage.setItem(KEY, JSON.stringify(safe)); } catch {}
    }
  }
  return rec;
}
export function readInstall(): InstallRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    let rec = JSON.parse(raw) as InstallRecord;
    rec = decryptStoredFilePassword(rec);
    if ((!rec.users || rec.users.length === 0) && rec.saltHex && rec.hashHex) {
      const admin: StoredUser = { id: crypto.randomUUID(), username: LEGACY_SINGLE_USER_NAME, role: "admin", saltHex: rec.saltHex, hashHex: rec.hashHex, permissions: defaultPermissions("admin") };
      rec.users = [admin]; writeInstall(rec);
    }
    return rec;
  } catch { return null; }
}
export function writeInstall(rec: InstallRecord) {
  let safe = { ...rec };
  if (safe.filePassword && secretStorageAvailable()) {
    const encrypted = secureSecret(safe.filePassword);
    if (encrypted) safe.filePassword = `${SECRET_PREFIX}${encrypted}`;
  } else if (!secretStorageAvailable()) {
    // Browser preview has no OS keychain. Do not persist the password there.
    safe.filePassword = undefined;
  }
  localStorage.setItem(KEY, JSON.stringify(safe));
  const mode = rec.deployMode ?? "single";
  void configureServer(mode, rec.serverPort ?? 4000, rec.pharmacyName);
  if (mode === "server") void syncServerUsers(rec.users ?? []);
}
export function updateInstall(patch: Partial<InstallRecord>) { const cur = readInstall(); if (!cur) return; writeInstall({ ...cur, ...patch }); }
export function deployMode(): DeployMode { return readInstall()?.deployMode ?? "single"; }
export function isClientMode() { return deployMode() === "client"; }
export function isMultiMode() { return deployMode() !== "single"; }
export async function setResetPassword(password: string) { const { saltHex, hashHex } = await hashPassword(password); updateInstall({ resetSaltHex: saltHex, resetHashHex: hashHex }); return { saltHex, hashHex }; }
export async function verifyResetPassword(password: string) { const rec = readInstall(); if (!rec?.resetSaltHex || !rec?.resetHashHex) return false; return verifyPassword(password, rec.resetSaltHex, rec.resetHashHex); }
export function clearInstall() { localStorage.removeItem(KEY); }
export async function createUser(input: { username: string; password: string; role: UserRole; permissions?: Partial<import("./users").UserPermissions> }): Promise<StoredUser> { const { saltHex, hashHex } = await hashPassword(input.password); return { id: crypto.randomUUID(), username: input.username.trim(), role: input.role, saltHex, hashHex, permissions: { ...defaultPermissions(input.role), ...(input.permissions ?? {}) } }; }
export async function findUserByLogin(username: string, password: string): Promise<StoredUser | null> { const rec = readInstall(); if (!rec) return null; const u = rec.users?.find((x) => x.username.toLowerCase() === username.trim().toLowerCase()); if (!u) return null; const ok = await verifyPassword(password, u.saltHex, u.hashHex); return ok ? u : null; }
export function upsertUser(u: StoredUser) { const rec = readInstall(); if (!rec) return; const users = rec.users ?? []; const i = users.findIndex((x) => x.id === u.id); if (i >= 0) users[i] = u; else users.push(u); writeInstall({ ...rec, users }); }
export function removeUser(id: string) { const rec = readInstall(); if (!rec) return; const users = (rec.users ?? []).filter((x) => x.id !== id); if (!users.some((x) => x.role === "admin")) return; writeInstall({ ...rec, users }); }
