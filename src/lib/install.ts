/**
 * First-run installation record kept in localStorage.
 * Stores a PBKDF2 hash of the app password + the last known data file path
 * (Electron only) so the app can auto-load on subsequent launches.
 */

const KEY = "medicore.install";

export interface InstallRecord {
  setupDone: true;
  pharmacyName: string;
  address: string;
  saltHex: string;
  hashHex: string;
  lastFsPath?: string; // Electron-only path to the .medicore file
  lastPath?: string; // display path (browser)
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
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export function readInstall(): InstallRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InstallRecord) : null;
  } catch {
    return null;
  }
}

export function writeInstall(rec: InstallRecord) {
  localStorage.setItem(KEY, JSON.stringify(rec));
}

export function updateInstall(patch: Partial<InstallRecord>) {
  const cur = readInstall();
  if (!cur) return;
  writeInstall({ ...cur, ...patch });
}

export function clearInstall() {
  localStorage.removeItem(KEY);
}

export async function hashPassword(password: string): Promise<{ saltHex: string; hashHex: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return { saltHex: toHex(salt), hashHex: toHex(bits) };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  const bits = await derive(password, fromHex(saltHex));
  return toHex(bits) === hashHex;
}
