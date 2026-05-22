"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Use a secure 32-byte key for AES-256
// In production, this MUST be set in environment variables (e.g., a random hex string)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-super-secret-key-ethicsec-32bytes!';
// If the fallback is not exactly 32 bytes, we hash it to get 32 bytes securely
const get32ByteKey = () => {
    if (Buffer.from(ENCRYPTION_KEY).length === 32)
        return Buffer.from(ENCRYPTION_KEY);
    return crypto_1.default.createHash('sha256').update(ENCRYPTION_KEY).digest();
};
const ALGORITHM = 'aes-256-gcm';
const encrypt = (text) => {
    if (!text)
        return text;
    // Create a 12-byte IV for GCM
    const iv = crypto_1.default.randomBytes(12);
    const key = get32ByteKey();
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};
exports.encrypt = encrypt;
const decrypt = (text) => {
    if (!text)
        return text;
    const parts = text.split(':');
    if (parts.length !== 3)
        return text; // If it's not in our format, return as is (maybe plain text or old data)
    try {
        const [ivHex, authTagHex, encryptedTextHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = get32ByteKey();
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        console.error('Decryption failed', error);
        return text; // Fallback or could throw error
    }
};
exports.decrypt = decrypt;
