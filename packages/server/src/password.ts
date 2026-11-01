import bcrypt from 'bcryptjs';

const ITERATIONS = 100_000;
const KEY_BITS = 256;
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** PBKDF2-SHA256 via Web Crypto — cheap enough for Workers CPU limits. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

/** Supports both new PBKDF2 hashes and legacy bcrypt `$2...` hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch {
      return false;
    }
  }
  const [scheme, iterationsText, saltText, hashText] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterationsText || !saltText || !hashText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const expected = fromHex(hashText);
  const actual = await derive(password, fromHex(saltText), iterations);
  return constantTimeEqual(actual, expected);
}
