import crypto from "node:crypto";

const SCRYPT_N = 16384, SCRYPT_r = 8, SCRYPT_p = 1, KEYLEN = 64;

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(secret.normalize(), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p }, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
  });
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split(":");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(secret.normalize(), salt, expected.length, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p }, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
  });
  return crypto.timingSafeEqual(expected, derived);
}

export function sha256(data: string): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
