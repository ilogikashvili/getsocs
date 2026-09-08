// Encryption utility for sensitive data
// Uses AES-256-GCM for authenticated encryption

const crypto = require('crypto');

// Get encryption key from environment, or use a fallback for dev/test
// In production, this should be stored in a secure vault like AWS Secrets Manager
function getEncryptionKey() {
  const key = process.env.DATA_ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('WARNING: DATA_ENCRYPTION_KEY not set. Using insecure development key.');
    console.warn('In production, set DATA_ENCRYPTION_KEY to a 32-byte hex string.');
    console.warn('Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    // Development key - DO NOT USE IN PRODUCTION
    return Buffer.from('00000000000000000000000000000000', 'hex');
  }
  
  if (key.length !== 64) { // 32 bytes = 64 hex characters
    throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @returns {string} JSON-encoded format: base64(iv + ciphertext + authTag)
 */
function encrypt(plaintext) {
  if (!plaintext) return null; // Don't encrypt empty/null values
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // 128-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv + ciphertext + authTag (all hex)
  const payload = iv.toString('hex') + encrypted + authTag.toString('hex');
  
  // Encode as JSON with marker to distinguish from plaintext
  return JSON.stringify({ __encrypted: true, data: payload });
}

/**
 * Decrypt a string encrypted with encrypt()
 * @param {string} encrypted - The encrypted data (JSON format)
 * @returns {string} The decrypted plaintext
 */
function decrypt(encrypted) {
  if (!encrypted) return null;
  
  try {
    // Check if it's encrypted (JSON format with __encrypted marker)
    if (typeof encrypted === 'string' && encrypted.startsWith('{')) {
      const parsed = JSON.parse(encrypted);
      if (!parsed.__encrypted) return encrypted; // Not encrypted, return as-is
      
      const key = getEncryptionKey();
      const payload = parsed.data;
      
      // Extract components (each 32 hex chars for 16 bytes, except last is 32)
      const iv = Buffer.from(payload.substring(0, 32), 'hex');
      const authTag = Buffer.from(payload.substring(payload.length - 32), 'hex');
      const ciphertext = payload.substring(32, payload.length - 32);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
  } catch (e) {
    console.error('Decryption error:', e.message);
    return null;
  }
  
  // If not encrypted format, return as-is
  return encrypted;
}

/**
 * Check if a value is encrypted
 * @param {*} value - The value to check
 * @returns {boolean} True if the value appears to be encrypted
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return parsed.__encrypted === true;
  } catch (e) {
    return false;
  }
}

module.exports = { encrypt, decrypt, isEncrypted, getEncryptionKey };
