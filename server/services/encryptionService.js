import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
// Ensure key is exactly 32 bytes
const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

export function encryptText(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

export function decryptText(encryptedText) {
  if (!encryptedText) return null;
  if (!encryptedText.includes(':')) return encryptedText; // Fallback if plain text
  try {
    const [ivHex, authTagHex, encryptedDataHex] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encryptedDataHex) return encryptedText;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
}

export function hashSearchTerm(text) {
  if (!text) return null;
  const normalized = String(text).trim().replace(/[\s\-_]/g, '').toLowerCase();
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

