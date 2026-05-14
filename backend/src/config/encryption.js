const crypto = require('crypto');

let KEY;
function getKey() {
  if (KEY) return KEY;
  const raw = process.env.MONITOR_ENCRYPTION_KEY;
  if (raw && raw.length === 64) {
    KEY = Buffer.from(raw, 'hex');
  } else {
    // Dev fallback: deterministic key from SUPABASE_URL so tokens survive restarts
    const seed = process.env.SUPABASE_URL || 'dippro-dev-fallback-key-32-bytes!!';
    KEY = crypto.createHash('sha256').update(seed).digest();
  }
  return KEY;
}

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
