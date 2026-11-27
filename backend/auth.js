import crypto from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const computed = crypto.scryptSync(String(password), salt, KEYLEN);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === computed.length && crypto.timingSafeEqual(stored, computed);
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Код восстановления: 12 символов, удобно переписать от руки
export function generateRecoveryCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}
