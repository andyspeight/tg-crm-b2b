import "server-only";

/**
 * Small symmetric encryption helper for secrets we must persist at runtime but
 * can't put in env — specifically the Google OAuth refresh token (obtained after
 * the user connects, so it can't be a build-time env var). The token is stored
 * AES-256-GCM encrypted; the key is derived from AUTH_SECRET, which lives only in
 * the server environment, so a leak of the data store alone can't decrypt it
 * (travelgenix-security: least privilege, secrets never at rest in the clear).
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | null = null;
async function aesKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set (required to encrypt secrets)");
  keyPromise = (async () => {
    // Derive a distinct 256-bit key from AUTH_SECRET so we never reuse the raw
    // session secret as the encryption key (key separation).
    const material = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${secret}|luna-desk:token-enc:v1`),
    );
    return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  })();
  return keyPromise;
}

/** Encrypt a UTF-8 string. Returns "v1:<base64(iv|ciphertext+tag)>". */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext)),
  );
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return `v1:${b64encode(packed)}`;
}

/** Decrypt a value produced by encryptSecret. Throws if tampered or wrong key. */
export async function decryptSecret(value: string): Promise<string> {
  if (!value.startsWith("v1:")) throw new Error("Unrecognised secret format");
  const packed = b64decode(value.slice(3));
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  const key = await aesKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return decoder.decode(pt);
}
