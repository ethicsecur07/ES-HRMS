import crypto from 'crypto';

// Use a secure 32-byte key for AES-256
// In production, this MUST be set in environment variables (e.g., a random hex string)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-super-secret-key-ethicsec-32bytes!';
// If the fallback is not exactly 32 bytes, we hash it to get 32 bytes securely
const get32ByteKey = () => {
  if (Buffer.from(ENCRYPTION_KEY).length === 32) return Buffer.from(ENCRYPTION_KEY);
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

const ALGORITHM = 'aes-256-gcm';

export const encrypt = (text: string): string => {
  if (!text) return text;
  
  // Create a 12-byte IV for GCM
  const iv = crypto.randomBytes(12);
  const key = get32ByteKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (text: string): string => {
  if (!text) return text;
  
  const parts = text.split(':');
  if (parts.length !== 3) return text; // If it's not in our format, return as is (maybe plain text or old data)
  
  try {
    const [ivHex, authTagHex, encryptedTextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = get32ByteKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed', error);
    return text; // Fallback or could throw error
  }
};
