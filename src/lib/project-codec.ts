/**
 * MediCore project file codec.
 * File layout is a JSON envelope:
 *   { magic:"MEDICORE", version:1, encrypted:boolean, salt?, iv?, payload }
 * When encrypted, payload is base64(ciphertext) of AES-GCM(JSON(payload)).
 * Key derivation: PBKDF2-SHA256(password, salt, 200k iters) -> 256-bit key.
 */

export const FILE_MAGIC = "MEDICORE";
export const FILE_VERSION = 1;

export type ProjectPayload = Record<string, unknown>;

export interface ProjectEnvelope {
  magic: typeof FILE_MAGIC;
  version: number;
  encrypted: boolean;
  salt?: string;
  iv?: string;
  payload: unknown;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  encode(buf: ArrayBuffer | Uint8Array) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },
  decode(s: string) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encodeProject(
  payload: ProjectPayload,
  password?: string,
): Promise<Uint8Array> {
  const json = JSON.stringify(payload);
  let envelope: ProjectEnvelope;

  if (password && password.length > 0) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(json),
    );
    envelope = {
      magic: FILE_MAGIC,
      version: FILE_VERSION,
      encrypted: true,
      salt: b64.encode(salt),
      iv: b64.encode(iv),
      payload: b64.encode(cipher),
    };
  } else {
    envelope = {
      magic: FILE_MAGIC,
      version: FILE_VERSION,
      encrypted: false,
      payload,
    };
  }
  return enc.encode(JSON.stringify(envelope));
}

export class WrongPasswordError extends Error {
  constructor() {
    super("Incorrect password");
    this.name = "WrongPasswordError";
  }
}
export class InvalidProjectFileError extends Error {
  constructor(msg = "This file is not a valid MediCore project.") {
    super(msg);
    this.name = "InvalidProjectFileError";
  }
}

export interface DecodedProject {
  payload: ProjectPayload;
  encrypted: boolean;
}

export async function peekEncrypted(bytes: Uint8Array): Promise<boolean> {
  const env = safeParseEnvelope(bytes);
  return env.encrypted;
}

function safeParseEnvelope(bytes: Uint8Array): ProjectEnvelope {
  let env: ProjectEnvelope;
  try {
    env = JSON.parse(dec.decode(bytes)) as ProjectEnvelope;
  } catch {
    throw new InvalidProjectFileError();
  }
  if (!env || env.magic !== FILE_MAGIC) throw new InvalidProjectFileError();
  return env;
}

export async function decodeProject(
  bytes: Uint8Array,
  password?: string,
): Promise<DecodedProject> {
  const env = safeParseEnvelope(bytes);

  if (!env.encrypted) {
    return { payload: env.payload as ProjectPayload, encrypted: false };
  }
  if (!password) throw new WrongPasswordError();
  if (!env.salt || !env.iv || typeof env.payload !== "string") {
    throw new InvalidProjectFileError();
  }
  try {
    const key = await deriveKey(password, b64.decode(env.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64.decode(env.iv) },
      key,
      b64.decode(env.payload),
    );
    return { payload: JSON.parse(dec.decode(plain)) as ProjectPayload, encrypted: true };
  } catch {
    throw new WrongPasswordError();
  }
}
