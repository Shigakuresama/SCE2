import crypto from 'node:crypto';

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function deriveKey(input: string): Buffer {
  if (!input || input.trim().length === 0) {
    throw new Error('SCE session encryption key is required');
  }

  return crypto.createHash('sha256').update(input).digest();
}

export function encryptJson(plainText: string, key: string): string {
  const derivedKey = deriveKey(key);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptJson(cipherText: string, key: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = cipherText.split('.');
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted payload format');
  }

  const derivedKey = deriveKey(key);
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);

  const plainText = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plainText.toString('utf8');
}
