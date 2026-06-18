import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const secret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'change-me-in-production-32-chars';
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32));
}

export function encryptCookieValue(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${encrypted.toString('hex')}.${tag.toString('hex')}`;
}

export function decryptCookieValue(ciphertext: string): string | null {
  try {
    const parts = ciphertext.split('.');
    if (parts.length !== 3) return null;
    const [ivHex, dataHex, tagHex] = parts;
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'), { authTagLength: 16 });
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
